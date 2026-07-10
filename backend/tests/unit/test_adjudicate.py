from __future__ import annotations

from app.graph.nodes.adjudicate import adjudicate_claim, rollup_overall_confidence, rollup_overall_verdict
from app.graph.nodes.calibration import compute_confidence
from app.schemas.state import (
    Claim,
    ClaimType,
    ClaimVerdict,
    EvidenceDoc,
    SourceTier,
    Stance,
    StanceResult,
    Verdict,
)


def claim(claim_id="c1", claim_type=ClaimType.EVENT) -> Claim:
    return Claim(claim_id=claim_id, text="text", claim_type=claim_type)


def evidence(evidence_id, claim_id="c1", tier=SourceTier.TIER_1, similarity=0.8) -> EvidenceDoc:
    return EvidenceDoc(
        evidence_id=evidence_id, claim_id=claim_id, url=f"https://x.com/{evidence_id}",
        domain="x.com", source_tier=tier, text="evidence text", similarity=similarity,
        retrieved_from="web",
    )


def stance(evidence_id, claim_id="c1", s=Stance.SUPPORTS, conf=0.9) -> StanceResult:
    return StanceResult.create(
        claim_id=claim_id, evidence_id=evidence_id, stance=s,
        stance_confidence=conf, span=("quoted span" if s != Stance.NEUTRAL else None),
        rationale="r",
    )


def adjudicate(c, ev, st):
    return adjudicate_claim(c, ev, st, confidence_fn=compute_confidence)


class TestAdjudicateRules:
    def test_opinion_claim_is_excluded_not_scored(self):
        c = claim(claim_type=ClaimType.OPINION)
        result = adjudicate(c, [evidence("e1")], [stance("e1")])
        assert result is None

    def test_no_evidence_is_unverifiable(self):
        result = adjudicate(claim(), [], [])
        assert result.verdict == Verdict.UNVERIFIABLE
        assert result.reason_code == "no_evidence"

    def test_all_neutral_is_unverifiable(self):
        ev = [evidence("e1"), evidence("e2")]
        st = [stance("e1", s=Stance.NEUTRAL, conf=0.5), stance("e2", s=Stance.NEUTRAL, conf=0.5)]
        result = adjudicate(claim(), ev, st)
        assert result.verdict == Verdict.UNVERIFIABLE
        assert result.reason_code == "all_neutral"

    def test_tier1_contradiction_is_misleading_context_never_coinflip(self):
        ev = [evidence("e1", tier=SourceTier.TIER_1), evidence("e2", tier=SourceTier.TIER_1)]
        st = [
            stance("e1", s=Stance.SUPPORTS, conf=0.9),
            stance("e2", s=Stance.REFUTES, conf=0.9),
        ]
        result = adjudicate(claim(), ev, st)
        assert result.verdict == Verdict.MISLEADING_CONTEXT
        assert result.reason_code == "tier1_contradiction"

    def test_tier1_vs_low_confidence_contradiction_does_not_trigger_rule4(self):
        # one side below the 0.5 confidence floor -> not a "real" contradiction,
        # falls through to the weight-majority rules instead.
        ev = [evidence("e1", tier=SourceTier.TIER_1), evidence("e2", tier=SourceTier.TIER_1)]
        st = [
            stance("e1", s=Stance.SUPPORTS, conf=0.95),
            stance("e2", s=Stance.REFUTES, conf=0.2),
        ]
        result = adjudicate(claim(), ev, st)
        assert result.verdict == Verdict.SUPPORTED
        assert result.reason_code == "support_majority"

    def test_mixed_evidence_below_agreement_threshold_is_misleading_context(self):
        ev = [evidence(f"e{i}", tier=SourceTier.TIER_2) for i in range(4)]
        st = [
            stance("e0", s=Stance.SUPPORTS, conf=0.7),
            stance("e1", s=Stance.SUPPORTS, conf=0.6),
            stance("e2", s=Stance.REFUTES, conf=0.7),
            stance("e3", s=Stance.REFUTES, conf=0.6),
        ]
        result = adjudicate(claim(), ev, st)
        assert result.verdict == Verdict.MISLEADING_CONTEXT
        assert result.reason_code == "mixed_evidence"

    def test_single_low_tier_source_is_unverifiable_insufficient_weight(self):
        ev = [evidence("e1", tier=SourceTier.TIER_3, similarity=0.6)]
        st = [stance("e1", s=Stance.SUPPORTS, conf=0.8)]
        result = adjudicate(claim(), ev, st)
        # weight = 0.3 * 0.8 = 0.24 < MIN_EVIDENCE_WEIGHT (0.5)
        assert result.verdict == Verdict.UNVERIFIABLE
        assert result.reason_code == "insufficient_weight"

    def test_total_agreement_multiple_tier1_is_supported(self):
        ev = [evidence("e1", tier=SourceTier.TIER_1), evidence("e2", tier=SourceTier.TIER_1)]
        st = [stance("e1", s=Stance.SUPPORTS, conf=0.9), stance("e2", s=Stance.SUPPORTS, conf=0.85)]
        result = adjudicate(claim(), ev, st)
        assert result.verdict == Verdict.SUPPORTED
        assert result.reason_code == "support_majority"
        assert result.confidence > 0.5

    def test_total_agreement_refuted(self):
        ev = [evidence("e1", tier=SourceTier.TIER_1), evidence("e2", tier=SourceTier.TIER_2)]
        st = [stance("e1", s=Stance.REFUTES, conf=0.9), stance("e2", s=Stance.REFUTES, conf=0.8)]
        result = adjudicate(claim(), ev, st)
        assert result.verdict == Verdict.REFUTED
        assert result.reason_code == "refute_majority"

    def test_supported_verdict_includes_supporting_evidence_ids(self):
        ev = [evidence("e1", tier=SourceTier.TIER_1)]
        st = [stance("e1", s=Stance.SUPPORTS, conf=0.9)]
        result = adjudicate(claim(), ev, st)
        assert result.supporting_evidence_ids == ["e1"]
        assert result.refuting_evidence_ids == []

    def test_unverifiable_confidence_is_capped_low(self):
        result = adjudicate(claim(), [], [])
        assert result.confidence <= 0.35
        assert result.confidence_interval[1] <= 0.35

    def test_net_stance_weight_sign_matches_direction(self):
        ev = [evidence("e1", tier=SourceTier.TIER_1)]
        supported = adjudicate(claim(), ev, [stance("e1", s=Stance.SUPPORTS, conf=0.9)])
        refuted = adjudicate(claim(), ev, [stance("e1", s=Stance.REFUTES, conf=0.9)])
        assert supported.net_stance_weight > 0
        assert refuted.net_stance_weight < 0

    def test_evidence_from_other_claims_is_ignored(self):
        ev = [evidence("e1", claim_id="c1", tier=SourceTier.TIER_1), evidence("e2", claim_id="c2", tier=SourceTier.TIER_1)]
        st = [stance("e1", claim_id="c1", s=Stance.SUPPORTS, conf=0.9), stance("e2", claim_id="c2", s=Stance.REFUTES, conf=0.9)]
        result = adjudicate(claim("c1"), ev, st)
        assert result.evidence_count == 1
        assert result.verdict == Verdict.SUPPORTED


class TestOverallRollup:
    def _verdict(self, v, conf=0.7):
        return ClaimVerdict(
            claim_id="x", verdict=v, confidence=conf, confidence_interval=(conf - 0.1, conf + 0.1),
            net_stance_weight=0.0, evidence_count=1, tier1_count=1,
            supporting_evidence_ids=[], refuting_evidence_ids=[], reason_code="r",
        )

    def test_refuted_dominates_supported(self):
        verdicts = [self._verdict(Verdict.SUPPORTED), self._verdict(Verdict.SUPPORTED), self._verdict(Verdict.REFUTED)]
        assert rollup_overall_verdict(verdicts) == Verdict.REFUTED

    def test_misleading_context_beats_unverifiable_and_supported(self):
        verdicts = [self._verdict(Verdict.SUPPORTED), self._verdict(Verdict.UNVERIFIABLE), self._verdict(Verdict.MISLEADING_CONTEXT)]
        assert rollup_overall_verdict(verdicts) == Verdict.MISLEADING_CONTEXT

    def test_all_supported_rolls_up_supported(self):
        verdicts = [self._verdict(Verdict.SUPPORTED), self._verdict(Verdict.SUPPORTED)]
        assert rollup_overall_verdict(verdicts) == Verdict.SUPPORTED

    def test_no_scored_claims_is_unverifiable(self):
        assert rollup_overall_verdict([]) == Verdict.UNVERIFIABLE

    def test_overall_confidence_averages_only_driving_claims(self):
        verdicts = [self._verdict(Verdict.SUPPORTED, conf=0.9), self._verdict(Verdict.REFUTED, conf=0.6)]
        conf = rollup_overall_confidence(verdicts, Verdict.REFUTED)
        assert conf == 0.6


class TestCalibration:
    def test_no_evidence_gives_low_confidence(self):
        conf, interval = compute_confidence(0, 0, 0.0, 0.0)
        assert conf < 0.15

    def test_maximal_evidence_gives_high_confidence(self):
        conf, interval = compute_confidence(8, 8, 1.0, 1.0)
        assert conf > 0.9

    def test_confidence_is_monotonic_in_agreement_ratio(self):
        low, _ = compute_confidence(4, 2, 0.5, 0.7)
        high, _ = compute_confidence(4, 2, 0.9, 0.7)
        assert high > low

    def test_interval_narrows_with_more_evidence(self):
        _, narrow_interval = compute_confidence(8, 4, 0.8, 0.8)
        _, wide_interval = compute_confidence(1, 1, 0.8, 0.8)
        narrow_width = narrow_interval[1] - narrow_interval[0]
        wide_width = wide_interval[1] - wide_interval[0]
        assert narrow_width < wide_width

    def test_interval_bounds_are_valid_probabilities(self):
        conf, (lower, upper) = compute_confidence(10, 10, 1.0, 1.0)
        assert 0.0 <= lower <= conf <= upper <= 1.0
