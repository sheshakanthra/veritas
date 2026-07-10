import type { SourceTier, Stance } from "@/lib/types";

/** Source-tier -> tie opacity. Mirrors the trust weighting in
 * backend/app/graph/nodes/adjudicate.py's TIER_WEIGHT, expressed visually:
 * a tier-3 tie should visibly recede, not just numerically discount. */
const TIER_OPACITY: Record<SourceTier, number> = {
  "1": 1.0,
  "2": 0.62,
  "3": 0.34,
};

export function tieOpacityForTier(tier: SourceTier): number {
  return TIER_OPACITY[tier];
}

const MIN_TIE_LENGTH_PX = 24;
const MAX_TIE_LENGTH_PX = 96;

/** Claim-evidence similarity (0-1) -> horizontal tie length in px. A
 * near-duplicate span reads as a long, confident tie; a loosely related
 * one stays short. */
export function tieLengthForSimilarity(similarity: number): number {
  const clamped = Math.min(1, Math.max(0, similarity));
  return MIN_TIE_LENGTH_PX + clamped * (MAX_TIE_LENGTH_PX - MIN_TIE_LENGTH_PX);
}

/** Stance -> the CSS custom property carrying that stance's color, so the
 * component layer never hardcodes a hex value. */
const STANCE_COLOR_VAR: Record<Stance, string> = {
  SUPPORTS: "var(--v-supports)",
  REFUTES: "var(--v-refutes)",
  NEUTRAL: "var(--v-neutral)",
};

export function tieColorVarForStance(stance: Stance): string {
  return STANCE_COLOR_VAR[stance];
}
