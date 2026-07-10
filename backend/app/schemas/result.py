from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from .state import Claim, ClaimVerdict, EvidenceDoc, StanceResult, TraceEvent, Verdict


class AnalysisResult(BaseModel):
    """The full, cacheable, API-facing result of one analysis run.

    Every scored claim must resolve to UNVERIFIABLE or carry at least one
    traceable span - enforced below, not left to convention.
    """

    analysis_id: UUID
    input_text: str
    input_type: str
    created_at: datetime

    claims: list[Claim]
    evidence: list[EvidenceDoc]
    stances: list[StanceResult]
    claim_verdicts: list[ClaimVerdict]

    overall_verdict: Verdict
    overall_confidence: float = Field(ge=0.0, le=1.0)
    explanation: str

    trace: list[TraceEvent]
    cache_hit: bool
    cache_key: str
    prompt_version: str
    model_id: str

    @model_validator(mode="after")
    def every_scored_claim_is_traceable(self) -> "AnalysisResult":
        spans_by_claim: dict[str, list[str]] = {}
        for s in self.stances:
            if s.span:
                spans_by_claim.setdefault(s.claim_id, []).append(s.span)

        for cv in self.claim_verdicts:
            if cv.verdict == Verdict.UNVERIFIABLE:
                continue
            if not spans_by_claim.get(cv.claim_id):
                raise ValueError(
                    f"claim {cv.claim_id} has verdict={cv.verdict} but no "
                    "traceable span - every non-UNVERIFIABLE verdict must "
                    "be grounded in at least one quoted span"
                )
        return self


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)


class AnalyzeAcceptedResponse(BaseModel):
    analysis_id: UUID


class DependencyHealth(BaseModel):
    name: str
    status: Literal["ok", "degraded", "down"]
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    dependencies: list[DependencyHealth]


class ReliabilityBin(BaseModel):
    bin_lower: float
    bin_upper: float
    predicted_confidence_mean: float
    empirical_accuracy: float
    sample_count: int


class CalibrationReport(BaseModel):
    bins: list[ReliabilityBin]
    total_samples: int
    expected_calibration_error: float
    note: str = "Fixture set is SYNTHETIC pending real labelled data."
