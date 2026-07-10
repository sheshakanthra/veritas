"""Provider-agnostic LLM interface. Both GroqProvider (phase 5) and
MockLLMProvider (phase 2) implement this same surface, so nothing above
this layer - the graph nodes - ever branches on which provider is active.
"""
from __future__ import annotations

from typing import Generic, Protocol, TypeVar

from pydantic import BaseModel, Field

from app.schemas.state import ClaimType, Stance

T = TypeVar("T")


class ClaimExtraction(BaseModel):
    text: str
    claim_type: ClaimType


class DecomposeResponse(BaseModel):
    claims: list[ClaimExtraction] = Field(max_length=5)


class StanceResponse(BaseModel):
    stance: Stance
    confidence: float = Field(ge=0.0, le=1.0)
    span: str | None = None
    rationale: str


class LLMResult(BaseModel, Generic[T]):
    """Wraps a parsed response with the token accounting the trace needs."""

    model_config = {"arbitrary_types_allowed": True}

    parsed: T
    token_count: int
    repaired: bool = False


class LLMProvider(Protocol):
    async def decompose(self, normalized_text: str) -> LLMResult[DecomposeResponse]: ...

    async def classify_stance(
        self, claim_text: str, evidence_text: str
    ) -> LLMResult[StanceResponse]: ...

    async def synthesize(
        self, claim_summaries: list[dict], retained_spans: list[str]
    ) -> LLMResult[str]: ...
