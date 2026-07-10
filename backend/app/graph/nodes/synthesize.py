"""One LLM call that writes a 2-4 sentence plain-language explanation
grounded ONLY in the retained (non-hallucinated) evidence spans.

Post-check: any generated sentence containing a number or a capitalized
multi-word phrase (a cheap proper-noun heuristic - no NER dependency) that
doesn't appear anywhere in the retained spans fails validation. One
regeneration is attempted, then a deterministic fallback template that
only states claim-verdict counts (trivially grounded, since it invents no
number that isn't a direct count of the claims themselves).
"""
from __future__ import annotations

import re

from app.providers.llm.base import LLMProvider
from app.schemas.state import VeritasState

_NUMBER_RE = re.compile(r"\b\d[\d,.]*%?\b")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z']*")


def _find_capitalized_phrases(sentence: str, skip_first_word: bool) -> list[str]:
    words = sentence.split()
    phrases: list[str] = []
    i = 0
    while i < len(words):
        cleaned = re.sub(r"[^\w]", "", words[i])
        is_sentence_start = i == 0 and skip_first_word
        if cleaned and cleaned[0].isupper() and not is_sentence_start:
            run = [cleaned]
            j = i + 1
            while j < len(words):
                next_cleaned = re.sub(r"[^\w]", "", words[j])
                if next_cleaned and next_cleaned[0].isupper():
                    run.append(next_cleaned)
                    j += 1
                else:
                    break
            phrases.append(" ".join(run))
            i = j
        else:
            i += 1
    return phrases


def _is_grounded(explanation: str, retained_spans: list[str]) -> bool:
    grounding_text = " ".join(retained_spans)
    allowed_numbers = set(_NUMBER_RE.findall(grounding_text))
    allowed_phrases = set(_find_capitalized_phrases(grounding_text, skip_first_word=False))

    for sentence in _SENTENCE_SPLIT_RE.split(explanation.strip()):
        for number in _NUMBER_RE.findall(sentence):
            if number not in allowed_numbers:
                return False
        for phrase in _find_capitalized_phrases(sentence, skip_first_word=True):
            if phrase not in allowed_phrases:
                return False
    return True


def _fallback_template(state: VeritasState) -> str:
    total = len(state.claim_verdicts)
    if total == 0:
        return "No individually checkable, non-opinion claims were found in this input."
    supported = sum(1 for cv in state.claim_verdicts if cv.verdict.value == "SUPPORTED")
    refuted = sum(1 for cv in state.claim_verdicts if cv.verdict.value == "REFUTED")
    misleading = sum(1 for cv in state.claim_verdicts if cv.verdict.value == "MISLEADING_CONTEXT")
    unverifiable = total - supported - refuted - misleading
    return (
        f"Of {total} claim{'s' if total != 1 else ''} examined, {supported} were supported, "
        f"{refuted} were refuted, {misleading} had missing or conflicting context, and "
        f"{unverifiable} could not be verified. See the evidence trail below for the source "
        "spans behind each verdict."
    )


def make_synthesize_node(llm_provider: LLMProvider):
    async def synthesize_node(state: VeritasState) -> dict:
        claim_by_id = {c.claim_id: c for c in state.claims}
        claim_summaries = [
            {
                "claim_id": cv.claim_id,
                "text": claim_by_id[cv.claim_id].text,
                "verdict": cv.verdict.value,
            }
            for cv in state.claim_verdicts
        ]
        retained_spans = [s.span for s in state.stances if s.span]

        if not claim_summaries:
            return {"explanation": _fallback_template(state), "_token_count": 0}

        result = await llm_provider.synthesize(claim_summaries, retained_spans)
        explanation = result.parsed
        token_count = result.token_count

        if not _is_grounded(explanation, retained_spans):
            retry = await llm_provider.synthesize(claim_summaries, retained_spans)
            token_count += retry.token_count
            if _is_grounded(retry.parsed, retained_spans):
                explanation = retry.parsed
            else:
                explanation = _fallback_template(state)

        return {"explanation": explanation, "_token_count": token_count}

    return synthesize_node
