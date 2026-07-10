import { describe, expect, it } from "vitest";
import { deflect, MAX_DEFLECTION_PX, KINK_FACTOR } from "@/components/spine/deflection";

describe("deflect", () => {
  describe("SUPPORTED", () => {
    it("is always plumb regardless of n or confidence", () => {
      expect(deflect("SUPPORTED", 1, 1).x).toBe(0);
      expect(deflect("SUPPORTED", 0.3, 0.9).x).toBe(0);
      expect(deflect("SUPPORTED", -0.1, 0.5).x).toBe(0);
    });

    it("renders a straight path with ties", () => {
      const result = deflect("SUPPORTED", 0.8, 0.9);
      expect(result.path).toBe("straight");
      expect(result.hasTies).toBe(true);
      expect(result.peakX).toBe(0);
    });
  });

  describe("UNVERIFIABLE", () => {
    it("is always plumb with no ties", () => {
      const result = deflect("UNVERIFIABLE", 0, 0);
      expect(result.x).toBe(0);
      expect(result.peakX).toBe(0);
      expect(result.hasTies).toBe(false);
      expect(result.path).toBe("straight");
    });

    it("ignores n and confidence entirely", () => {
      const a = deflect("UNVERIFIABLE", -1, 1);
      const b = deflect("UNVERIFIABLE", 1, 1);
      expect(a).toEqual(b);
    });
  });

  describe("REFUTED", () => {
    it("deflects right at full magnitude when fully refuted and fully confident", () => {
      const result = deflect("REFUTED", -1, 1);
      expect(result.x).toBeCloseTo(MAX_DEFLECTION_PX);
      expect(result.peakX).toBeCloseTo(MAX_DEFLECTION_PX);
      expect(result.path).toBe("straight");
    });

    it("is plumb when n is support-leaning despite a REFUTED verdict input", () => {
      // Exercises the clamp - a REFUTED call with positive n (which
      // adjudicate.py would never actually produce) must still not
      // deflect left; the geometry has no negative-x branch at all.
      const result = deflect("REFUTED", 0.5, 1);
      expect(result.x).toBe(0);
    });

    it("scales linearly with confidence at fixed n", () => {
      const low = deflect("REFUTED", -1, 0.25);
      const high = deflect("REFUTED", -1, 1);
      expect(high.x).toBeCloseTo(low.x * 4);
    });

    it("scales with the refute-leaning magnitude of n at fixed confidence", () => {
      const partial = deflect("REFUTED", -0.5, 1);
      const full = deflect("REFUTED", -1, 1);
      expect(partial.x).toBeCloseTo(full.x / 2);
    });

    it("is zero at n = 0 (perfectly balanced) even at full confidence", () => {
      expect(deflect("REFUTED", 0, 1).x).toBe(0);
    });
  });

  describe("MISLEADING_CONTEXT", () => {
    it("always returns to plumb (x = 0)", () => {
      expect(deflect("MISLEADING_CONTEXT", 0, 1).x).toBe(0);
      expect(deflect("MISLEADING_CONTEXT", 0.9, 0.9).x).toBe(0);
    });

    it("renders a kink path with a nonzero peak at nonzero confidence", () => {
      const result = deflect("MISLEADING_CONTEXT", 0, 0.8);
      expect(result.path).toBe("kink");
      expect(result.peakX).toBeGreaterThan(0);
    });

    it("caps its peak below REFUTED's max at equal confidence, never reading as more severe", () => {
      const kink = deflect("MISLEADING_CONTEXT", 0, 1);
      const refuted = deflect("REFUTED", -1, 1);
      expect(kink.peakX).toBeCloseTo(MAX_DEFLECTION_PX * KINK_FACTOR);
      expect(kink.peakX).toBeLessThan(refuted.peakX);
    });

    it("ignores n - magnitude comes from confidence in the conflict alone", () => {
      const a = deflect("MISLEADING_CONTEXT", -0.9, 0.7);
      const b = deflect("MISLEADING_CONTEXT", 0.9, 0.7);
      expect(a.peakX).toBeCloseTo(b.peakX);
    });

    it("has zero peak at zero confidence", () => {
      expect(deflect("MISLEADING_CONTEXT", 0, 0).peakX).toBe(0);
    });
  });

  describe("input clamping", () => {
    it("clamps out-of-range n and confidence rather than producing an out-of-bounds offset", () => {
      const result = deflect("REFUTED", -5, 5);
      expect(result.x).toBeCloseTo(MAX_DEFLECTION_PX);
    });
  });
});
