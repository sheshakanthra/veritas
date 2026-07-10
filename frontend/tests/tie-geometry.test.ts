import { describe, expect, it } from "vitest";
import {
  tieOpacityForTier,
  tieLengthForSimilarity,
  tieColorVarForStance,
} from "@/components/spine/tie-geometry";

describe("tieOpacityForTier", () => {
  it("maps tier 1 to full opacity", () => {
    expect(tieOpacityForTier("1")).toBe(1.0);
  });

  it("maps tier 2 to 62%", () => {
    expect(tieOpacityForTier("2")).toBe(0.62);
  });

  it("maps tier 3 to 34%", () => {
    expect(tieOpacityForTier("3")).toBe(0.34);
  });

  it("is monotonically decreasing from tier 1 to tier 3", () => {
    expect(tieOpacityForTier("1")).toBeGreaterThan(tieOpacityForTier("2"));
    expect(tieOpacityForTier("2")).toBeGreaterThan(tieOpacityForTier("3"));
  });
});

describe("tieLengthForSimilarity", () => {
  it("is monotonically increasing in similarity", () => {
    expect(tieLengthForSimilarity(0)).toBeLessThan(tieLengthForSimilarity(0.5));
    expect(tieLengthForSimilarity(0.5)).toBeLessThan(tieLengthForSimilarity(1));
  });

  it("clamps out-of-range similarity", () => {
    expect(tieLengthForSimilarity(-1)).toBe(tieLengthForSimilarity(0));
    expect(tieLengthForSimilarity(2)).toBe(tieLengthForSimilarity(1));
  });
});

describe("tieColorVarForStance", () => {
  it("returns a distinct CSS var per stance", () => {
    const supports = tieColorVarForStance("SUPPORTS");
    const refutes = tieColorVarForStance("REFUTES");
    const neutral = tieColorVarForStance("NEUTRAL");
    expect(new Set([supports, refutes, neutral]).size).toBe(3);
  });

  it("never returns a raw hex value", () => {
    expect(tieColorVarForStance("SUPPORTS")).toMatch(/^var\(--v-/);
  });
});
