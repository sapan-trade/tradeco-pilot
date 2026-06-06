import { describe, it, expect } from "vitest";
import { computeAccuracy } from "@/server/services/accuracy";

describe("computeAccuracy", () => {
  it("scores accuracy from decisions and extracts correction pairs", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const a = computeAccuracy([
      { decision: "APPROVED", decidedAt: d("2026-05-02"), originalHsCode: "8517.13.0000", correctedHsCode: null },
      { decision: "APPROVED", decidedAt: d("2026-05-10"), originalHsCode: "6109.10.0010", correctedHsCode: null },
      { decision: "CORRECTED", decidedAt: d("2026-05-15"), originalHsCode: "6109.10.0010", correctedHsCode: "6109.10.0099" },
      { decision: "REJECTED", decidedAt: d("2026-05-20"), originalHsCode: "9999.99.9999", correctedHsCode: null },
    ]);

    expect(a.decided).toBe(4);
    expect(a.approved).toBe(2);
    expect(a.corrected).toBe(1);
    expect(a.rejected).toBe(1);
    // 2 approved / (2 + 1) = 67%
    expect(a.accuracyPct).toBe(67);
    expect(a.byMonth).toEqual([{ month: "2026-05", accuracyPct: 67, scored: 3 }]);
    expect(a.corrections).toEqual([
      { from: "6109.10.0010", to: "6109.10.0099", decidedAt: d("2026-05-15").toISOString() },
    ]);
  });

  it("returns null accuracy when nothing scorable", () => {
    const a = computeAccuracy([{ decision: "REJECTED", decidedAt: new Date(), originalHsCode: null, correctedHsCode: null }]);
    expect(a.accuracyPct).toBeNull();
    expect(a.corrections).toEqual([]);
  });
});
