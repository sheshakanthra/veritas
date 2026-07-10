"""Core domain models threaded through the LangGraph pipeline.

VeritasState is the single mutable-by-append object passed between nodes.
Each node returns a partial-update dict (LangGraph merges it into state);
by convention nodes only ever *add* to `claims`, `evidence`, `stances`,
`claim_verdicts`, and `trace` - never mutate an existing entry in place.
"""
from __future__ import annotations

import operator
from datetime import datetime, timezone
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Verdict(StrEnum):
    SUPPORTED = "SUPPORTED"
    REFUTED = "REFUTED"
    MISLEADING_CONTEXT = "MISLEADING_CONTEXT"
    UNVERIFIABLE = "UNVERIFIABLE"


class ClaimType(StrEnum):
    STATISTICAL = "statistical"
    CAUSAL = "causal"
    ATTRIBUTIVE = "attributive"
    EVENT = "event"
    OPINION = "opinion"


class Stance(StrEnum):
    SUPPORTS = "SUPPORTS"
    REFUTES = "REFUTES"
    NEUTRAL = "NEUTRAL"


class SourceTier(StrEnum):
    TIER_1 = "1"
    TIER_2 = "2"
    TIER_3 = "3"


class InputType(StrEnum):
    CLAIM = "claim"
    HEADLINE = "headline"
    URL = "url"


class ErrorCode(StrEnum):
    INPUT_TOO_SHORT = "input_too_short"
    URL_EXTRACTION_FAILED = "url_extraction_failed"
    GROQ_RATE_LIMITED = "groq_rate_limited"
    GROQ_UNAVAILABLE = "groq_unavailable"
    SCHEMA_VALIDATION_FAILED = "schema_validation_failed"
    NODE_TIMEOUT = "node_timeout"
    NO_SCORABLE_CLAIMS = "no_scorable_claims"


class VeritasError(BaseModel):
    model_config = ConfigDict(frozen=True)

    code: ErrorCode
    message: str
    node: str
    retryable: bool = False


class Claim(BaseModel):
    model_config = ConfigDict(frozen=True)

    claim_id: str
    text: str
    claim_type: ClaimType
    scored: bool = True

    @model_validator(mode="after")
    def opinions_are_never_scored(self) -> "Claim":
        if self.claim_type == ClaimType.OPINION and self.scored:
            object.__setattr__(self, "scored", False)
        return self


class EvidenceDoc(BaseModel):
    model_config = ConfigDict(frozen=True)

    evidence_id: str
    claim_id: str
    url: str
    domain: str
    source_tier: SourceTier
    text: str
    similarity: float = Field(ge=0.0, le=1.0)
    retrieved_from: Literal["corpus", "web"]


class StanceResult(BaseModel):
    """The anti-hallucination gate lives here: if the model cannot produce a
    verbatim supporting span, the stance is forced to NEUTRAL in code, not
    left to prompt discipline."""

    model_config = ConfigDict(frozen=True)

    claim_id: str
    evidence_id: str
    stance: Stance
    stance_confidence: float = Field(ge=0.0, le=1.0)
    span: str | None = Field(default=None, max_length=400)
    rationale: str

    @classmethod
    def create(
        cls,
        claim_id: str,
        evidence_id: str,
        stance: Stance,
        stance_confidence: float,
        span: str | None,
        rationale: str,
    ) -> "StanceResult":
        """Preferred constructor - enforces the no-span-means-NEUTRAL gate
        before the frozen model is built, rather than relying on callers to
        remember it."""
        if stance != Stance.NEUTRAL and not span:
            stance = Stance.NEUTRAL
            stance_confidence = 0.0
        return cls(
            claim_id=claim_id,
            evidence_id=evidence_id,
            stance=stance,
            stance_confidence=stance_confidence,
            span=span,
            rationale=rationale,
        )


class ClaimVerdict(BaseModel):
    model_config = ConfigDict(frozen=True)

    claim_id: str
    verdict: Verdict
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_interval: tuple[float, float]
    net_stance_weight: float = Field(ge=-1.0, le=1.0)
    evidence_count: int = Field(ge=0)
    tier1_count: int = Field(ge=0)
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    refuting_evidence_ids: list[str] = Field(default_factory=list)
    reason_code: str


class TraceEvent(BaseModel):
    node: str
    status: Literal["pending", "running", "done", "error"]
    latency_ms: int | None = None
    token_count: int | None = None
    cache_hit: bool = False
    error: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VeritasState(BaseModel):
    model_config = ConfigDict(frozen=False, arbitrary_types_allowed=True)

    analysis_id: UUID = Field(default_factory=uuid4)
    raw_input: str
    input_type: InputType | None = None
    normalized_text: str | None = None

    claims: list[Claim] = Field(default_factory=list)
    evidence: list[EvidenceDoc] = Field(default_factory=list)
    stances: list[StanceResult] = Field(default_factory=list)
    claim_verdicts: list[ClaimVerdict] = Field(default_factory=list)

    explanation: str | None = None
    overall_verdict: Verdict | None = None
    overall_confidence: float | None = None

    # Every node appends its own TraceEvent; the operator.add reducer tells
    # LangGraph to concatenate each node's returned {"trace": [...]} update
    # instead of overwriting the accumulated list.
    trace: Annotated[list[TraceEvent], operator.add] = Field(default_factory=list)
    prompt_version: str = "v1"
    model_id: str = "llama-3.3-70b-versatile"

    error: VeritasError | None = None

    def with_trace(self, event: TraceEvent) -> "VeritasState":
        self.trace.append(event)
        return self
