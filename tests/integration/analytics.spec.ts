import { describe, it, expect } from "vitest";
import { computeAnalytics } from "@/server/services/analytics";

describe("computeAnalytics", () => {
  it("aggregates status mix, duty, FTA, turnaround, declarations, and chapters", () => {
    const now = Date.now();
    const s = computeAnalytics({
      classifications: [
        { status: "AUTO_APPROVED", confidence: 0.9, hsCode: "8517.13.0000", ftaEligible: true },
        { status: "AUTO_APPROVED", confidence: 0.8, hsCode: "8517.62.0090", ftaEligible: false },
        { status: "NEEDS_REVIEW", confidence: 0.5, hsCode: "6109.10.0010", ftaEligible: null },
      ],
      reviews: [
        { createdAt: new Date(now - 2 * 3_600_000), decidedAt: new Date(now) }, // 2h
        { createdAt: new Date(now - 4 * 3_600_000), decidedAt: new Date(now) }, // 4h
      ],
      declarations: [{ status: "DRAFT" }, { status: "SUBMITTED" }, { status: "SUBMITTED" }],
      estimates: [
        // newest-first; first per classification wins
        { classificationId: "c1", dutyRateBps: 1000, unitValueCents: 10000, totalLandedCents: 12000 },
        { classificationId: "c1", dutyRateBps: 9999, unitValueCents: 9999, totalLandedCents: 99999 }, // ignored (older dup)
        { classificationId: "c2", dutyRateBps: 500, unitValueCents: 20000, totalLandedCents: 22000 },
      ],
    });

    expect(s.totalClassified).toBe(3);
    expect(s.statusCounts.AUTO_APPROVED).toBe(2);
    expect(s.statusCounts.NEEDS_REVIEW).toBe(1);
    expect(s.ftaEligibleCount).toBe(1);
    expect(s.avgConfidencePct).toBe(73); // (0.9+0.8+0.5)/3 = 0.7333 -> 73
    // duty: c1 = 10000*1000/10000=1000; c2 = 20000*500/10000=1000 => 2000
    expect(s.estimatedDutyCents).toBe(2000);
    expect(s.estimatedLandedCents).toBe(34000); // 12000 + 22000 (dup ignored)
    expect(s.brokerDecidedCount).toBe(2);
    expect(s.avgTurnaroundHours).toBe(3); // (2+4)/2
    expect(s.declarations).toEqual({ draft: 1, submitted: 2, total: 3 });
    expect(s.topChapters[0]).toEqual({ chapter: "8517", count: 2 });
  });

  it("handles an empty org without dividing by zero", () => {
    const s = computeAnalytics({ classifications: [], reviews: [], declarations: [], estimates: [] });
    expect(s.totalClassified).toBe(0);
    expect(s.avgConfidencePct).toBe(0);
    expect(s.avgTurnaroundHours).toBeNull();
    expect(s.topChapters).toEqual([]);
  });
});
