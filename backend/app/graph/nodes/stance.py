"""For each (claim, evidence) pair, classify stance. The anti-hallucination
gate (no verbatim span => forced NEUTRAL) is enforced by StanceResult.create
itself, not by trusting the prompt.
"""
from __future__ import annotations

from app.providers.llm.base import LLMProvider
from app.schemas.state import StanceResult, VeritasState


def make_stance_node(llm_provider: LLMProvider):
    async def stance_node(state: VeritasState) -> dict:
        stances: list[StanceResult] = []
        total_tokens = 0

        for claim in state.claims:
            if not claim.scored:
                continue
            claim_evidence = [e for e in state.evidence if e.claim_id == claim.claim_id]
            for evidence in claim_evidence:
                result = await llm_provider.classify_stance(claim.text, evidence.text)
                total_tokens += result.token_count
                stances.append(
                    StanceResult.create(
                        claim_id=claim.claim_id,
                        evidence_id=evidence.evidence_id,
                        stance=result.parsed.stance,
                        stance_confidence=result.parsed.confidence,
                        span=result.parsed.span,
                        rationale=result.parsed.rationale,
                    )
                )

        return {"stances": stances, "_token_count": total_tokens}

    return stance_node
