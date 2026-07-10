"""Normalizes raw input: detects claim / headline / URL, extracts article
text from URLs via trafilatura, and rejects inputs that are too short to
possibly contain a checkable claim.
"""
from __future__ import annotations

import re

from app.schemas.state import ErrorCode, InputType, VeritasError, VeritasState

MIN_TOKENS = 15
_URL_RE = re.compile(r"^https?://\S+$", re.IGNORECASE)
_WORD_RE = re.compile(r"\S+")


def _detect_input_type(text: str) -> InputType:
    stripped = text.strip()
    if _URL_RE.match(stripped):
        return InputType.URL
    if len(_WORD_RE.findall(stripped)) <= 20 and "\n" not in stripped:
        return InputType.HEADLINE
    return InputType.CLAIM


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


async def extract_article_text(url: str) -> str | None:
    """Isolated so it can be monkeypatched in tests without pulling in a
    real network call; trafilatura itself does the HTTP fetch + extraction."""
    import trafilatura

    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return None
    return trafilatura.extract(downloaded)


async def ingest_node(state: VeritasState) -> dict:
    raw = state.raw_input
    input_type = _detect_input_type(raw)

    text = raw
    if input_type == InputType.URL:
        extracted = await extract_article_text(raw)
        if not extracted or len(_WORD_RE.findall(extracted)) < MIN_TOKENS:
            return {
                "input_type": input_type,
                "error": VeritasError(
                    code=ErrorCode.URL_EXTRACTION_FAILED,
                    message="That URL didn't return readable article text. Paste the text instead.",
                    node="ingest",
                    retryable=False,
                ),
            }
        text = extracted

    normalized = _normalize(text)
    if len(_WORD_RE.findall(normalized)) < MIN_TOKENS:
        return {
            "input_type": input_type,
            "normalized_text": normalized,
            "error": VeritasError(
                code=ErrorCode.INPUT_TOO_SHORT,
                message=f"Input is too short to extract a checkable claim (minimum {MIN_TOKENS} words).",
                node="ingest",
                retryable=False,
            ),
        }

    return {"input_type": input_type, "normalized_text": normalized}
