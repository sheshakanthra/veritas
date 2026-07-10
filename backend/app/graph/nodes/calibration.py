"""Confidence is derived from measurable evidence features, never from an
LLM's self-reported percentage - LLMs are badly calibrated and asking one
"how confident are you, 0-100" is a bug, not a metric.

confidence = sigmoid(
    W_EVIDENCE   * evidence_count_norm   # more corroborating sources
  + W_TIER1      * tier1_fraction        # how much of it is high-trust
  + W_AGREEMENT  * agreement_ratio       # how one-sided the evidence is
  + W_SIMILARITY * mean_similarity       # how on-topic the evidence is
  - BIAS
)

Weights are hand-set, not fit, and ranked by how much each feature should
move confidence: agreement and tier-1 presence matter most (a claim is
only as trustworthy as its best-corroborated, highest-trust evidence);
raw evidence count matters somewhat (diminishing returns, hence the
saturating normalization); topical similarity matters least on its own,
because evidence can be on-topic and still contradict the claim.
"""
from __future__ import annotations

import math
from collections import defaultdict

from app.schemas.result import CalibrationReport, ReliabilityBin

W_EVIDENCE = 1.1
W_TIER1 = 1.6
W_AGREEMENT = 1.8
W_SIMILARITY = 0.9
BIAS = 2.4

# Evidence count beyond this contributes nothing further - eight
# corroborating sources is already as convincing as it gets.
EVIDENCE_COUNT_SATURATION = 8.0

# Interval half-width shrinks as evidence accumulates: sparse evidence
# gets an honestly wide band, not false precision.
INTERVAL_BASE_HALF_WIDTH = 0.28
INTERVAL_MIN_HALF_WIDTH = 0.05


def _sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def compute_confidence(
    evidence_count: int,
    tier1_count: int,
    agreement_ratio: float,
    mean_similarity: float,
) -> tuple[float, tuple[float, float]]:
    evidence_count_norm = min(evidence_count / EVIDENCE_COUNT_SATURATION, 1.0)
    tier1_fraction = (tier1_count / evidence_count) if evidence_count > 0 else 0.0

    raw = (
        W_EVIDENCE * evidence_count_norm
        + W_TIER1 * tier1_fraction
        + W_AGREEMENT * agreement_ratio
        + W_SIMILARITY * mean_similarity
        - BIAS
    )
    confidence = round(_sigmoid(raw), 3)

    half_width = max(
        INTERVAL_MIN_HALF_WIDTH,
        INTERVAL_BASE_HALF_WIDTH / math.sqrt(evidence_count + 1),
    )
    lower = round(max(0.0, confidence - half_width), 3)
    upper = round(min(1.0, confidence + half_width), 3)
    return confidence, (lower, upper)


def build_calibration_report(
    labelled_examples: list[dict],
    n_bins: int = 5,
) -> CalibrationReport:
    """Reliability-bin table over a labelled fixture set for
    /health/calibration. Each example needs `predicted_confidence` (float)
    and `correct` (bool - did the predicted verdict match the label)."""
    if not labelled_examples:
        return CalibrationReport(bins=[], total_samples=0, expected_calibration_error=0.0)

    bin_width = 1.0 / n_bins
    buckets: dict[int, list[dict]] = defaultdict(list)
    for ex in labelled_examples:
        idx = min(int(ex["predicted_confidence"] / bin_width), n_bins - 1)
        buckets[idx].append(ex)

    bins: list[ReliabilityBin] = []
    total = len(labelled_examples)
    ece = 0.0
    for idx in range(n_bins):
        examples = buckets.get(idx, [])
        lower, upper = idx * bin_width, (idx + 1) * bin_width
        if not examples:
            bins.append(
                ReliabilityBin(
                    bin_lower=lower, bin_upper=upper,
                    predicted_confidence_mean=0.0, empirical_accuracy=0.0,
                    sample_count=0,
                )
            )
            continue
        mean_conf = sum(e["predicted_confidence"] for e in examples) / len(examples)
        accuracy = sum(1 for e in examples if e["correct"]) / len(examples)
        bins.append(
            ReliabilityBin(
                bin_lower=lower, bin_upper=upper,
                predicted_confidence_mean=round(mean_conf, 3),
                empirical_accuracy=round(accuracy, 3),
                sample_count=len(examples),
            )
        )
        ece += (len(examples) / total) * abs(mean_conf - accuracy)

    return CalibrationReport(
        bins=bins, total_samples=total, expected_calibration_error=round(ece, 3)
    )
