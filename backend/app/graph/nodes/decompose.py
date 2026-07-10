"""Extracts 1-5 atomic, individually checkable claims from the normalized
text. Opinion claims are kept (never silently dropped) but marked
unscored by the Claim model itself - downstream nodes decide what to do
with that flag.
"""
from __future__ import annotations

from app.providers.llm.base import LLMProvider
from app.schemas.state import Claim, VeritasState


def make_decompose_node(llm_provider: LLMProvider):
    async def decompose_node(state: VeritasState) -> dict:
        result = await llm_provider.decompose(state.normalized_text or state.raw_input)
        claims = [
            Claim(claim_id=f"c{i + 1}", text=c.text, claim_type=c.claim_type)
            for i, c in enumerate(result.parsed.claims)
        ]
        return {"claims": claims, "_token_count": result.token_count}

    return decompose_node
