import { deflect, type DeflectionResult } from "@/components/spine/deflection";
import type { ClaimVerdict } from "@/lib/types";

export const ROW_HEIGHT_PX = 96;
export const SPINE_BASE_X_PX = 24;

export interface SpineNodeLayout {
  claimId: string;
  y: number;
  x: number;
  deflection: DeflectionResult;
}

export interface SpinePathSegment {
  claimId: string;
  /** SVG path `d` fragment for this row's vertical span, meant to be
   * concatenated after an initial "M startX startY". */
  d: string;
}

/**
 * Threads a single continuous polyline through every claim node: each
 * row starts wherever the previous row's deflection left off (so a
 * REFUTED claim's rightward pull visibly carries into the next row's
 * starting point) and resolves to its own resting x by the row's end.
 * MISLEADING_CONTEXT rows bulge out to their peak at the row's vertical
 * center, via a quadratic curve, then return to plumb.
 */
export function computeSpineLayout(
  verdicts: ClaimVerdict[]
): { nodes: SpineNodeLayout[]; segments: SpinePathSegment[]; totalHeight: number } {
  const nodes: SpineNodeLayout[] = [];
  const segments: SpinePathSegment[] = [];
  let currentX = SPINE_BASE_X_PX;

  verdicts.forEach((verdict, i) => {
    const rowTop = i * ROW_HEIGHT_PX;
    const rowCenter = rowTop + ROW_HEIGHT_PX / 2;
    const rowBottom = rowTop + ROW_HEIGHT_PX;

    const d = deflect(verdict.verdict, verdict.net_stance_weight, verdict.confidence);
    const restingX = SPINE_BASE_X_PX + d.x;

    const startX = currentX;
    const startY = rowTop;

    let path: string;
    if (d.path === "kink") {
      const peakX = SPINE_BASE_X_PX + d.peakX;
      path = `M ${startX} ${startY} Q ${peakX} ${rowCenter} ${restingX} ${rowBottom}`;
    } else {
      path = `M ${startX} ${startY} L ${restingX} ${rowBottom}`;
    }

    segments.push({ claimId: verdict.claim_id, d: path });
    nodes.push({ claimId: verdict.claim_id, x: restingX, y: rowCenter, deflection: d });
    currentX = restingX;
  });

  return { nodes, segments, totalHeight: verdicts.length * ROW_HEIGHT_PX };
}
