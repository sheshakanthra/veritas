import type { Verdict } from "@/lib/types";

/**
 * Maps (verdict, net_stance_weight, confidence) to the Spine's geometry at
 * one claim node. This is the whole design thesis in code: the picture
 * cannot say something the adjudicator's numbers don't back up.
 *
 * `verdict` selects the *shape* (it's a deterministic function of the same
 * evidence aggregate computed in adjudicate.py - not an independent
 * artistic choice). `net_stance_weight` (n, in [-1, 1]: -1 fully refuted,
 * +1 fully supported) and `confidence` (C, in [0, 1]) drive the
 * *magnitude*.
 *
 *   SUPPORTED           -> plumb (x = 0). Truth doesn't bend the spine.
 *   UNVERIFIABLE        -> plumb, no ties at all.
 *   REFUTED             -> deflects right only: clamp(-n, 0, 1) means a
 *                          support-leaning n (>= 0) still renders plumb,
 *                          and only the refute-leaning component of n
 *                          pulls the spine, scaled by confidence.
 *   MISLEADING_CONTEXT  -> kinks out and returns to plumb. By construction
 *                          n is near zero here (that's why adjudicate.py
 *                          called it "mixed"), so magnitude instead comes
 *                          from confidence in the conflict itself, capped
 *                          below REFUTED's max via KINK_FACTOR so a kink
 *                          never reads as more severe than a full
 *                          refutation at equal confidence.
 */

export const MAX_DEFLECTION_PX = 48;
export const KINK_FACTOR = 0.6;

export type SpinePath = "straight" | "kink";

export interface DeflectionResult {
  /** Resting x-offset in px where the spine sits after this node. */
  x: number;
  /** Maximum x excursion in px - equals `x` for straight paths, and the
   * kink's outward peak (before returning to 0) for MISLEADING_CONTEXT. */
  peakX: number;
  path: SpinePath;
  hasTies: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function deflect(verdict: Verdict, netStanceWeight: number, confidence: number): DeflectionResult {
  const n = clamp(netStanceWeight, -1, 1);
  const c = clamp(confidence, 0, 1);

  switch (verdict) {
    case "SUPPORTED":
      return { x: 0, peakX: 0, path: "straight", hasTies: true };

    case "UNVERIFIABLE":
      return { x: 0, peakX: 0, path: "straight", hasTies: false };

    case "REFUTED": {
      const magnitude = MAX_DEFLECTION_PX * clamp(-n, 0, 1) * c;
      return { x: magnitude, peakX: magnitude, path: "straight", hasTies: true };
    }

    case "MISLEADING_CONTEXT": {
      const peak = MAX_DEFLECTION_PX * KINK_FACTOR * c;
      return { x: 0, peakX: peak, path: "kink", hasTies: true };
    }
  }
}
