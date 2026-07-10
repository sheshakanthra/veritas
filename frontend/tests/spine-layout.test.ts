import { describe, expect, it } from "vitest";
import { computeSpineLayout, ROW_HEIGHT_PX, SPINE_BASE_X_PX } from "@/components/spine/layout";
import type { ClaimVerdict } from "@/lib/types";

function verdict(overrides: Partial<ClaimVerdict>): ClaimVerdict {
  return {
    claim_id: "c1",
    verdict: "SUPPORTED",
    confidence: 0.8,
    confidence_interval: [0.6, 0.9],
    net_stance_weight: 0.8,
    evidence_count: 2,
    tier1_count: 1,
    supporting_evidence_ids: [],
    refuting_evidence_ids: [],
    reason_code: "support_majority",
    ...overrides,
  };
}

describe("computeSpineLayout", () => {
  it("reserves total height purely from claim count, before any tie renders", () => {
    const { totalHeight } = computeSpineLayout([verdict({}), verdict({ claim_id: "c2" })]);
    expect(totalHeight).toBe(2 * ROW_HEIGHT_PX);
  });

  it("places one node per claim in order", () => {
    const { nodes } = computeSpineLayout([
      verdict({ claim_id: "c1" }),
      verdict({ claim_id: "c2" }),
      verdict({ claim_id: "c3" }),
    ]);
    expect(nodes.map((n) => n.claimId)).toEqual(["c1", "c2", "c3"]);
    expect(nodes[0].y).toBeLessThan(nodes[1].y);
    expect(nodes[1].y).toBeLessThan(nodes[2].y);
  });

  it("a REFUTED row's rightward pull carries into the next row's starting point", () => {
    const { segments } = computeSpineLayout([
      verdict({ claim_id: "c1", verdict: "REFUTED", net_stance_weight: -1, confidence: 1 }),
      verdict({ claim_id: "c2", verdict: "SUPPORTED" }),
    ]);
    // second segment's path must start (M x y) at the same x the first segment ended at
    const firstEndX = Number(segments[0].d.split(" ").at(-2));
    const secondStartX = Number(segments[1].d.split(" ")[1]);
    expect(secondStartX).toBeCloseTo(firstEndX);
  });

  it("SUPPORTED and UNVERIFIABLE nodes sit exactly at the base x", () => {
    const { nodes } = computeSpineLayout([
      verdict({ claim_id: "c1", verdict: "SUPPORTED" }),
      verdict({ claim_id: "c2", verdict: "UNVERIFIABLE", confidence: 0, net_stance_weight: 0 }),
    ]);
    expect(nodes[0].x).toBe(SPINE_BASE_X_PX);
    expect(nodes[1].x).toBe(SPINE_BASE_X_PX);
  });

  it("MISLEADING_CONTEXT rows use a quadratic curve and resolve back to base x", () => {
    const { segments, nodes } = computeSpineLayout([
      verdict({ claim_id: "c1", verdict: "MISLEADING_CONTEXT", net_stance_weight: 0, confidence: 0.8 }),
    ]);
    expect(segments[0].d).toContain("Q");
    expect(nodes[0].x).toBe(SPINE_BASE_X_PX);
  });
});
