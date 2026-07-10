"""Deterministic verdict aggregation. No LLM call happens here - every rule
is plain Python so it's auditable and unit-testable in isolation, and so
the same evidence set always produces the same verdict.

Rule table (first match wins), where per (claim, evidence) pair:
    weight = TIER_WEIGHT[source_tier] * stance_confidence

and, aggregated over all evidence for a claim:
    S = sum(weight) over SUPPORTS pairs
    R = sum(weight) over REFUTES pairs
    N = sum(weight) over NEUTRAL pairs
    T = S + R + N
    agreement_ratio = max(S, R) / (S + R)   if S + R > 0 else 0
    net_stance_weight (n) = (S - R) / T     if T > 0        else 0

 1. claim.claim_type == OPINION                                -> excluded (not adjudicated)
 2. no evidence at all                                          -> UNVERIFIABLE  (no_evidence)
 3. S == 0 and R == 0 (only NEUTRAL/no signal)                  -> UNVERIFIABLE  (all_neutral)
 4. two tier-1 sources, one SUPPORTS one REFUTES, both conf>=0.5 -> MISLEADING_CONTEXT (tier1_contradiction)
 5. S > 0 and R > 0 and agreement_ratio < AGREEMENT_THRESHOLD    -> MISLEADING_CONTEXT (mixed_evidence)
 6. T < MIN_EVIDENCE_WEIGHT                                      -> UNVERIFIABLE  (insufficient_weight)
 7. S > R and agreement_ratio >= AGREEMENT_THRESHOLD             -> SUPPORTED     (support_majority)
 8. R > S and agreement_ratio >= AGREEMENT_THRESHOLD             -> REFUTED       (refute_majority)
 9. fallthrough (should be unreachable if 1-8 are exhaustive)    -> UNVERIFIABLE  (unclassified)
"""
from __future__ import annotations

from dataclasses import dataclass

from app.schemas.state import (
    Claim,
    ClaimType,
    ClaimVerdict,
    EvidenceDoc,
    SourceTier,
    Stance,
    StanceResult,
    Verdict,
    VeritasState,
)

# Tier gap is multiplicative, not additive: two tier-3 sources (0.3 each,
# weight 0.6 combined at full confidence) still can't outweigh one tier-1
# source (1.0) at the same confidence. This is what makes "contradiction
# between two tier-1 sources -> MISLEADING_CONTEXT, never a coin flip" hold.
TIER_WEIGHT: dict[SourceTier, float] = {
    SourceTier.TIER_1: 1.0,
    SourceTier.TIER_2: 0.6,
    SourceTier.TIER_3: 0.3,
}

# Below this total weighted evidence mass, we don't trust a direction even
# if 100% of it agrees - e.g. a single tier-3 source at 0.8 confidence
# (weight 0.24) is not enough to call SUPPORTED or REFUTED.
MIN_EVIDENCE_WEIGHT = 0.5

# Below this, evidence "agrees" too weakly to call a clean winner even
# though one side outweighs the other - it reads as contested, not settled.
AGREEMENT_THRESHOLD = 0.65

# A tier-1 vs tier-1 head-on contradiction needs both sides to actually
# mean it, not a low-confidence hedge.
TIER1_CONTRADICTION_MIN_CONFIDENCE = 0.5


@dataclass(frozen=True)
class _Aggregate:
    support_weight: float
    refute_weight: float
    neutral_weight: float
    total_weight: float
    net_stance_weight: float
    agreement_ratio: float
    tier1_count: int
    evidence_count: int
    supporting_evidence_ids: list[str]
    refuting_evidence_ids: list[str]
    has_tier1_contradiction: bool


def _aggregate(
    claim: Claim,
    evidence: list[EvidenceDoc],
    stances: list[StanceResult],
) -> _Aggregate:
    evidence_by_id = {e.evidence_id: e for e in evidence if e.claim_id == claim.claim_id}
    claim_stances = [s for s in stances if s.claim_id == claim.claim_id]

    support_weight = refute_weight = neutral_weight = 0.0
    supporting_ids: list[str] = []
    refuting_ids: list[str] = []
    tier1_supports: list[StanceResult] = []
    tier1_refutes: list[StanceResult] = []

    for stance in claim_stances:
        ev = evidence_by_id.get(stance.evidence_id)
        if ev is None:
            continue
        weight = TIER_WEIGHT[ev.source_tier] * stance.stance_confidence

        if stance.stance == Stance.SUPPORTS:
            support_weight += weight
            supporting_ids.append(stance.evidence_id)
            if ev.source_tier == SourceTier.TIER_1:
                tier1_supports.append(stance)
        elif stance.stance == Stance.REFUTES:
            refute_weight += weight
            refuting_ids.append(stance.evidence_id)
            if ev.source_tier == SourceTier.TIER_1:
                tier1_refutes.append(stance)
        else:
            neutral_weight += weight

    total_weight = support_weight + refute_weight + neutral_weight
    agreement_ratio = (
        max(support_weight, refute_weight) / (support_weight + refute_weight)
        if (support_weight + refute_weight) > 0
        else 0.0
    )
    net_stance_weight = (support_weight - refute_weight) / total_weight if total_weight > 0 else 0.0

    has_tier1_contradiction = any(
        s.stance_confidence >= TIER1_CONTRADICTION_MIN_CONFIDENCE for s in tier1_supports
    ) and any(s.stance_confidence >= TIER1_CONTRADICTION_MIN_CONFIDENCE for s in tier1_refutes)

    return _Aggregate(
        support_weight=support_weight,
        refute_weight=refute_weight,
        neutral_weight=neutral_weight,
        total_weight=total_weight,
        net_stance_weight=net_stance_weight,
        agreement_ratio=agreement_ratio,
        tier1_count=sum(1 for e in evidence_by_id.values() if e.source_tier == SourceTier.TIER_1),
        evidence_count=len(evidence_by_id),
        supporting_evidence_ids=supporting_ids,
        refuting_evidence_ids=refuting_ids,
        has_tier1_contradiction=has_tier1_contradiction,
    )


def _verdict_and_reason(agg: _Aggregate) -> tuple[Verdict, str]:
    if agg.evidence_count == 0:
        return Verdict.UNVERIFIABLE, "no_evidence"

    if agg.support_weight == 0 and agg.refute_weight == 0:
        return Verdict.UNVERIFIABLE, "all_neutral"

    if agg.has_tier1_contradiction:
        return Verdict.MISLEADING_CONTEXT, "tier1_contradiction"

    if agg.support_weight > 0 and agg.refute_weight > 0 and agg.agreement_ratio < AGREEMENT_THRESHOLD:
        return Verdict.MISLEADING_CONTEXT, "mixed_evidence"

    if agg.total_weight < MIN_EVIDENCE_WEIGHT:
        return Verdict.UNVERIFIABLE, "insufficient_weight"

    if agg.support_weight > agg.refute_weight and agg.agreement_ratio >= AGREEMENT_THRESHOLD:
        return Verdict.SUPPORTED, "support_majority"

    if agg.refute_weight > agg.support_weight and agg.agreement_ratio >= AGREEMENT_THRESHOLD:
        return Verdict.REFUTED, "refute_majority"

    return Verdict.UNVERIFIABLE, "unclassified"


def adjudicate_claim(
    claim: Claim,
    evidence: list[EvidenceDoc],
    stances: list[StanceResult],
    confidence_fn,
) -> ClaimVerdict | None:
    """Returns None for opinion claims - they are excluded from scoring,
    not silently defaulted to a verdict. `confidence_fn` is injected
    (calibration.py's `compute_confidence`) to keep this module free of
    the calibration weights, per the "adjudicate is deterministic
    aggregation, calibration is a separate concern" split."""
    if claim.claim_type == ClaimType.OPINION or not claim.scored:
        return None

    agg = _aggregate(claim, evidence, stances)
    verdict, reason_code = _verdict_and_reason(agg)

    mean_similarity = (
        sum(e.similarity for e in evidence if e.claim_id == claim.claim_id) / agg.evidence_count
        if agg.evidence_count > 0
        else 0.0
    )
    confidence, interval = confidence_fn(
        evidence_count=agg.evidence_count,
        tier1_count=agg.tier1_count,
        agreement_ratio=agg.agreement_ratio,
        mean_similarity=mean_similarity,
    )
    if verdict == Verdict.UNVERIFIABLE:
        confidence = min(confidence, 0.35)
        interval = (interval[0], min(interval[1], 0.35))

    return ClaimVerdict(
        claim_id=claim.claim_id,
        verdict=verdict,
        confidence=confidence,
        confidence_interval=interval,
        net_stance_weight=agg.net_stance_weight,
        evidence_count=agg.evidence_count,
        tier1_count=agg.tier1_count,
        supporting_evidence_ids=agg.supporting_evidence_ids,
        refuting_evidence_ids=agg.refuting_evidence_ids,
        reason_code=reason_code,
    )


_SEVERITY_ORDER = {
    Verdict.REFUTED: 3,
    Verdict.MISLEADING_CONTEXT: 2,
    Verdict.UNVERIFIABLE: 1,
    Verdict.SUPPORTED: 0,
}


def rollup_overall_verdict(claim_verdicts: list[ClaimVerdict]) -> Verdict:
    """One false or contested claim should not be laundered by several
    supported ones, so the most severe per-claim verdict wins. An
    all-opinion input (nothing scored) reads as UNVERIFIABLE."""
    if not claim_verdicts:
        return Verdict.UNVERIFIABLE
    return max(claim_verdicts, key=lambda cv: _SEVERITY_ORDER[cv.verdict]).verdict


def rollup_overall_confidence(claim_verdicts: list[ClaimVerdict], overall_verdict: Verdict) -> float:
    """Confidence of the overall verdict is the mean confidence of the
    claims that produced that verdict (not all claims - a REFUTED overall
    verdict driven by one high-confidence claim shouldn't be diluted by an
    unrelated SUPPORTED claim's confidence)."""
    driving = [cv.confidence for cv in claim_verdicts if cv.verdict == overall_verdict]
    if not driving:
        return 0.0
    return round(sum(driving) / len(driving), 3)


def make_adjudicate_node():
    """Graph node wrapper around the pure functions above. Kept separate so
    adjudicate_claim/rollup_overall_* stay directly unit-testable without a
    VeritasState fixture."""
    from app.graph.nodes.calibration import compute_confidence

    async def adjudicate_node(state: VeritasState) -> dict:
        claim_verdicts = []
        for claim in state.claims:
            verdict = adjudicate_claim(claim, state.evidence, state.stances, compute_confidence)
            if verdict is not None:
                claim_verdicts.append(verdict)

        overall_verdict = rollup_overall_verdict(claim_verdicts)
        overall_confidence = rollup_overall_confidence(claim_verdicts, overall_verdict)

        return {
            "claim_verdicts": claim_verdicts,
            "overall_verdict": overall_verdict,
            "overall_confidence": overall_confidence,
        }

    return adjudicate_node
