"""Deterministic, offline stand-in for the Groq provider.

Every method is pure Python over the input text - no network, no
randomness - so MOCK_MODE=true produces byte-identical output for
identical input, and the whole pipeline is demoable with zero API key.

The heuristics here are intentionally simple (keyword/overlap based). Their
job is not to be a good NLP model; it's to exercise the exact same
contracts (DecomposeResponse, StanceResponse, the anti-hallucination span
gate) that the real Groq provider must satisfy, so nothing above the
provider layer needs to know which one is active.
"""
from __future__ import annotations

import re

from app.providers.llm.base import (
    ClaimExtraction,
    DecomposeResponse,
    LLMResult,
    StanceResponse,
)
from app.schemas.state import ClaimType, Stance

_OPINION_MARKERS = {
    "should", "believe", "think", "feel", "best", "worst", "great",
    "terrible", "amazing", "awful", "wonderful", "disgusting", "beautiful",
    "opinion", "i think", "i believe", "in my view", "arguably",
}
_CAUSAL_MARKERS = {
    "because", "due to", "caused by", "causes", "caused", "leads to",
    "led to", "results in", "resulted in", "triggered", "as a result of",
}
_ATTRIBUTIVE_MARKERS = {
    "said", "says", "according to", "claims", "claimed", "stated",
    "reported", "told", "announced", "confirmed", "denied",
}
_NEGATION_MARKERS = {
    "not", "no", "never", "false", "denies", "denied", "disputed",
    "debunked", "incorrect", "inaccurate", "refutes", "refuted",
    "contradicts", "contradicted", "untrue", "myth", "hoax", "without merit",
}

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_NUMBER_RE = re.compile(r"\d")
_WORD_RE = re.compile(r"[a-z0-9']+")


def _tokenize(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


def _classify_claim_type(sentence: str) -> ClaimType:
    lowered = sentence.lower()
    if any(marker in lowered for marker in _OPINION_MARKERS):
        return ClaimType.OPINION
    if any(marker in lowered for marker in _ATTRIBUTIVE_MARKERS):
        return ClaimType.ATTRIBUTIVE
    if any(marker in lowered for marker in _CAUSAL_MARKERS):
        return ClaimType.CAUSAL
    if _NUMBER_RE.search(sentence):
        return ClaimType.STATISTICAL
    return ClaimType.EVENT


def _split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in _SENTENCE_SPLIT_RE.split(text.strip()) if p.strip()]
    return parts if parts else [text.strip()]


class MockLLMProvider:
    async def decompose(self, normalized_text: str) -> LLMResult[DecomposeResponse]:
        sentences = _split_sentences(normalized_text)[:5]
        claims = [
            ClaimExtraction(text=s, claim_type=_classify_claim_type(s))
            for s in sentences
        ]
        return LLMResult(
            parsed=DecomposeResponse(claims=claims),
            token_count=len(normalized_text.split()),
        )

    async def classify_stance(
        self, claim_text: str, evidence_text: str
    ) -> LLMResult[StanceResponse]:
        claim_tokens = _tokenize(claim_text)
        evidence_sentences = _split_sentences(evidence_text)

        best_sentence = ""
        best_overlap = 0.0
        for sentence in evidence_sentences:
            sent_tokens = _tokenize(sentence)
            if not sent_tokens or not claim_tokens:
                continue
            overlap = len(claim_tokens & sent_tokens) / len(claim_tokens | sent_tokens)
            if overlap > best_overlap:
                best_overlap = overlap
                best_sentence = sentence

        token_count = len(claim_text.split()) + len(evidence_text.split())

        overlap_threshold = 0.12
        if best_overlap < overlap_threshold or not best_sentence:
            return LLMResult(
                parsed=StanceResponse(
                    stance=Stance.NEUTRAL,
                    confidence=round(1.0 - best_overlap, 2),
                    span=None,
                    rationale=(
                        "No evidence sentence shares enough vocabulary with "
                        "the claim to support a stance."
                    ),
                ),
                token_count=token_count,
            )

        span = " ".join(best_sentence.split()[:25])
        evidence_has_negation = any(m in best_sentence.lower() for m in _NEGATION_MARKERS)
        claim_has_negation = any(m in claim_text.lower() for m in _NEGATION_MARKERS)
        # A negation marker in the evidence that isn't already part of the
        # claim's own framing reads as a refutation of the claim.
        is_refutation = evidence_has_negation and not claim_has_negation

        stance = Stance.REFUTES if is_refutation else Stance.SUPPORTS
        confidence = round(min(0.5 + best_overlap, 0.97), 2)
        rationale = (
            f"Evidence sentence overlaps {best_overlap:.0%} of claim vocabulary "
            f"and {'contains a negation/denial marker' if is_refutation else 'echoes the claim directly'}."
        )

        return LLMResult(
            parsed=StanceResponse(
                stance=stance, confidence=confidence, span=span, rationale=rationale
            ),
            token_count=token_count,
        )

    async def synthesize(
        self, claim_summaries: list[dict], retained_spans: list[str]
    ) -> LLMResult[str]:
        total = len(claim_summaries)
        supported = sum(1 for c in claim_summaries if c["verdict"] == "SUPPORTED")
        refuted = sum(1 for c in claim_summaries if c["verdict"] == "REFUTED")
        misleading = sum(1 for c in claim_summaries if c["verdict"] == "MISLEADING_CONTEXT")
        unverifiable = total - supported - refuted - misleading

        parts = [
            f"Of {total} claim{'s' if total != 1 else ''} examined, "
            f"{supported} supported, {refuted} refuted, {misleading} flagged as "
            f"missing context, and {unverifiable} unverifiable."
        ]
        if retained_spans:
            parts.append(f'The strongest evidence states: "{retained_spans[0]}"')
        text = " ".join(parts)
        return LLMResult(parsed=text, token_count=len(text.split()))
