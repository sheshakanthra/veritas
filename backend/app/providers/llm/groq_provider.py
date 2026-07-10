"""Real LLM provider - Groq free tier, model llama-3.3-70b-versatile,
temperature 0.0 always (never overridable per call - deterministic
classification/extraction is a hard constraint, not a default).

Every response is parsed through a Pydantic schema with a repair-and-retry
loop (max `schema_repair_max_retries`, default 2): on a validation
failure, we send the model its own bad output plus the error and ask it
to correct itself. If retries are exhausted, we raise - callers (the
`traced` node wrapper) convert that into a typed VeritasError rather than
silently returning a guessed result.

Separately, 429s from Groq itself are retried with exponential backoff
(`max_retries`, `backoff_base_seconds`) via tenacity - this is transport-
level retry, independent of and outside the schema-repair loop above.
"""
from __future__ import annotations

import json
import re

from pydantic import BaseModel, ValidationError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.prompts import decompose_v1, stance_v1, synthesize_v1
from app.providers.llm.base import DecomposeResponse, LLMResult, StanceResponse


class SchemaRepairExhausted(Exception):
    pass


def _is_rate_limit_error(exc: BaseException) -> bool:
    status = getattr(exc, "status_code", None) or getattr(
        getattr(exc, "response", None), "status_code", None
    )
    return status == 429 or "rate limit" in str(exc).lower()


def _extract_json(text: str) -> str:
    """Models sometimes wrap JSON in markdown fences despite instructions
    not to - strip that before parsing rather than failing on it."""
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced:
        return fenced.group(1)
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    return brace_match.group(0) if brace_match else text


class GroqProvider:
    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float,
        max_retries: int,
        backoff_base_seconds: float,
        schema_repair_max_retries: int,
    ) -> None:
        from langchain_groq import ChatGroq

        self._schema_repair_max_retries = schema_repair_max_retries
        self._client = ChatGroq(
            api_key=api_key,
            model=model,
            temperature=0.0,  # hard constraint - never accept a non-zero override
        )
        self._call_with_backoff = retry(
            retry=retry_if_exception(_is_rate_limit_error),
            stop=stop_after_attempt(max_retries),
            wait=wait_exponential(multiplier=backoff_base_seconds, min=backoff_base_seconds),
            reraise=True,
        )(self._raw_complete)

    async def _raw_complete(self, system: str, user: str) -> tuple[str, int]:
        response = await self._client.ainvoke(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
        text = response.content if isinstance(response.content, str) else str(response.content)
        usage = getattr(response, "usage_metadata", None) or {}
        token_count = usage.get("total_tokens", len(text.split()))
        return text, token_count

    async def _complete_with_repair(
        self, system: str, user: str, schema: type[BaseModel], repair_template: str,
        extra_validate=None,
    ) -> LLMResult:
        last_error: str = ""
        last_response: str = ""
        total_tokens = 0

        for attempt in range(self._schema_repair_max_retries + 1):
            prompt = user if attempt == 0 else repair_template.format(
                error=last_error, previous_response=last_response
            )
            raw_text, tokens = await self._call_with_backoff(system, prompt)
            total_tokens += tokens
            last_response = raw_text

            try:
                candidate = schema.model_validate_json(_extract_json(raw_text))
                if extra_validate is not None:
                    extra_validate(candidate)
            except (ValidationError, json.JSONDecodeError, ValueError) as exc:
                last_error = str(exc)
                continue

            return LLMResult(parsed=candidate, token_count=total_tokens, repaired=attempt > 0)

        raise SchemaRepairExhausted(
            f"Could not obtain a valid {schema.__name__} after "
            f"{self._schema_repair_max_retries} repair attempts. Last error: {last_error}"
        )

    async def decompose(self, normalized_text: str) -> LLMResult[DecomposeResponse]:
        return await self._complete_with_repair(
            system=decompose_v1.SYSTEM_PROMPT,
            user=decompose_v1.USER_TEMPLATE.format(text=normalized_text),
            schema=DecomposeResponse,
            repair_template=decompose_v1.REPAIR_TEMPLATE,
        )

    async def classify_stance(
        self, claim_text: str, evidence_text: str
    ) -> LLMResult[StanceResponse]:
        def _validate_span(candidate: StanceResponse) -> None:
            if candidate.stance != "NEUTRAL" and candidate.span:
                if candidate.span not in evidence_text:
                    raise ValueError(
                        f'span "{candidate.span}" is not a verbatim substring of the evidence'
                    )

        return await self._complete_with_repair(
            system=stance_v1.SYSTEM_PROMPT,
            user=stance_v1.USER_TEMPLATE.format(claim_text=claim_text, evidence_text=evidence_text),
            schema=StanceResponse,
            repair_template=stance_v1.REPAIR_TEMPLATE,
            extra_validate=_validate_span,
        )

    async def synthesize(
        self, claim_summaries: list[dict], retained_spans: list[str]
    ) -> LLMResult[str]:
        summaries_text = "\n".join(
            f"- [{c['claim_id']}] ({c['verdict']}) {c['text']}" for c in claim_summaries
        )
        spans_text = "\n".join(f'- "{s}"' for s in retained_spans) or "(no spans retained)"

        text, tokens = await self._call_with_backoff(
            synthesize_v1.SYSTEM_PROMPT,
            synthesize_v1.USER_TEMPLATE.format(
                claim_summaries=summaries_text, retained_spans=spans_text
            ),
        )
        return LLMResult(parsed=text.strip(), token_count=tokens)
