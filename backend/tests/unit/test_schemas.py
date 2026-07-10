from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.result import AnalysisResult
from app.schemas.state import (
    Claim,
    ClaimType,
    ClaimVerdict,
    EvidenceDoc,
    Stance,
    StanceResult,
    Verdict,
    VeritasState,
)


def _claim(claim_id="c1", claim_type=ClaimType.EVENT, scored=True) -> Claim:
    return Claim(claim_id=claim_id, text="The bridge reopened Tuesday.", claim_type=claim_type, scored=scored)


def _evidence(evidence_id="e1", claim_id="c1", tier="1") -> EvidenceDoc:
    return EvidenceDoc(
        evidence_id=evidence_id,
        claim_id=claim_id,
        url="https://reuters.com/a",
        domain="reuters.com",
        source_tier=tier,
        text="The bridge reopened Tuesday after repairs.",
        similarity=0.9,
        retrieved_from="web",
    )


class TestClaim:
    def test_opinion_claims_are_forced_unscored(self):
        claim = Claim(claim_id="c1", text="I think tacos are the best food.", claim_type=ClaimType.OPINION, scored=True)
        assert claim.scored is False

    def test_non_opinion_claims_default_scored(self):
        claim = _claim()
        assert claim.scored is True

    def test_claim_is_frozen(self):
        claim = _claim()
        with pytest.raises(ValidationError):
            claim.text = "mutated"


class TestStanceResultAntiHallucinationGate:
    def test_supports_without_span_is_forced_neutral(self):
        result = StanceResult.create(
            claim_id="c1", evidence_id="e1", stance=Stance.SUPPORTS,
            stance_confidence=0.9, span=None, rationale="no span available",
        )
        assert result.stance == Stance.NEUTRAL
        assert result.stance_confidence == 0.0

    def test_refutes_without_span_is_forced_neutral(self):
        result = StanceResult.create(
            claim_id="c1", evidence_id="e1", stance=Stance.REFUTES,
            stance_confidence=0.8, span=None, rationale="no span available",
        )
        assert result.stance == Stance.NEUTRAL

    def test_supports_with_span_is_preserved(self):
        result = StanceResult.create(
            claim_id="c1", evidence_id="e1", stance=Stance.SUPPORTS,
            stance_confidence=0.9, span="the bridge reopened", rationale="direct match",
        )
        assert result.stance == Stance.SUPPORTS
        assert result.stance_confidence == 0.9

    def test_neutral_without_span_stays_neutral(self):
        result = StanceResult.create(
            claim_id="c1", evidence_id="e1", stance=Stance.NEUTRAL,
            stance_confidence=0.4, span=None, rationale="unrelated",
        )
        assert result.stance == Stance.NEUTRAL


class TestVeritasState:
    def test_defaults_are_empty_collections(self):
        state = VeritasState(raw_input="Some claim text here.")
        assert state.claims == []
        assert state.trace == []
        assert state.error is None

    def test_with_trace_appends(self):
        from app.schemas.state import TraceEvent

        state = VeritasState(raw_input="claim")
        state.with_trace(TraceEvent(node="ingest", status="done"))
        assert len(state.trace) == 1
        assert state.trace[0].node == "ingest"

    def test_analysis_id_is_unique_per_instance(self):
        a = VeritasState(raw_input="x")
        b = VeritasState(raw_input="x")
        assert a.analysis_id != b.analysis_id


class TestAnalysisResultTraceabilityGate:
    def _base_kwargs(self):
        return dict(
            analysis_id=uuid4(),
            input_text="The bridge reopened Tuesday.",
            input_type="claim",
            created_at=datetime.now(timezone.utc),
            claims=[_claim()],
            evidence=[_evidence()],
            trace=[],
            cache_hit=False,
            cache_key="abc123",
            prompt_version="v1",
            model_id="mock",
        )

    def test_supported_verdict_without_span_raises(self):
        kwargs = self._base_kwargs()
        with pytest.raises(ValidationError):
            AnalysisResult(
                **kwargs,
                stances=[
                    StanceResult.create(
                        claim_id="c1", evidence_id="e1", stance=Stance.SUPPORTS,
                        stance_confidence=0.9, span=None, rationale="x",
                    )
                ],
                claim_verdicts=[
                    ClaimVerdict(
                        claim_id="c1", verdict=Verdict.SUPPORTED, confidence=0.8,
                        confidence_interval=(0.6, 0.9), net_stance_weight=0.8,
                        evidence_count=1, tier1_count=1,
                        supporting_evidence_ids=["e1"], refuting_evidence_ids=[],
                        reason_code="support_majority",
                    )
                ],
                overall_verdict=Verdict.SUPPORTED,
                overall_confidence=0.8,
                explanation="The claim is supported.",
            )

    def test_supported_verdict_with_span_is_valid(self):
        kwargs = self._base_kwargs()
        result = AnalysisResult(
            **kwargs,
            stances=[
                StanceResult.create(
                    claim_id="c1", evidence_id="e1", stance=Stance.SUPPORTS,
                    stance_confidence=0.9, span="the bridge reopened Tuesday", rationale="x",
                )
            ],
            claim_verdicts=[
                ClaimVerdict(
                    claim_id="c1", verdict=Verdict.SUPPORTED, confidence=0.8,
                    confidence_interval=(0.6, 0.9), net_stance_weight=0.8,
                    evidence_count=1, tier1_count=1,
                    supporting_evidence_ids=["e1"], refuting_evidence_ids=[],
                    reason_code="support_majority",
                )
            ],
            overall_verdict=Verdict.SUPPORTED,
            overall_confidence=0.8,
            explanation="The claim is supported.",
        )
        assert result.overall_verdict == Verdict.SUPPORTED

    def test_unverifiable_verdict_never_requires_a_span(self):
        kwargs = self._base_kwargs()
        result = AnalysisResult(
            **kwargs,
            stances=[],
            claim_verdicts=[
                ClaimVerdict(
                    claim_id="c1", verdict=Verdict.UNVERIFIABLE, confidence=0.0,
                    confidence_interval=(0.0, 0.2), net_stance_weight=0.0,
                    evidence_count=0, tier1_count=0,
                    supporting_evidence_ids=[], refuting_evidence_ids=[],
                    reason_code="no_evidence",
                )
            ],
            overall_verdict=Verdict.UNVERIFIABLE,
            overall_confidence=0.0,
            explanation="Not enough evidence to rule either way.",
        )
        assert result.overall_verdict == Verdict.UNVERIFIABLE
