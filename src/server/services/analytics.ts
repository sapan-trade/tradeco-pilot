/** Pure aggregation for the org analytics dashboard — kept separate so it's unit-testable. */

export interface AnalyticsInput {
  classifications: {
    status: string;
    confidence: number;
    hsCode: string;
    ftaEligible: boolean | null;
  }[];
  reviews: { createdAt: Date; decidedAt: Date | null }[];
  declarations: { status: string }[];
  // Pre-sorted newest-first; we keep the latest estimate per classification.
  estimates: {
    classificationId: string;
    dutyRateBps: number;
    unitValueCents: number;
    totalLandedCents: number;
  }[];
}

export interface AnalyticsSummary {
  totalClassified: number;
  statusCounts: Record<string, number>;
  ftaEligibleCount: number;
  avgConfidencePct: number;
  estimatedDutyCents: number;
  estimatedLandedCents: number;
  brokerDecidedCount: number;
  avgTurnaroundHours: number | null;
  declarations: { draft: number; submitted: number; total: number };
  topChapters: { chapter: string; count: number }[];
}

export function computeAnalytics(input: AnalyticsInput): AnalyticsSummary {
  const { classifications, reviews, declarations, estimates } = input;

  const statusCounts: Record<string, number> = {};
  const chapterCounts: Record<string, number> = {};
  let confidenceSum = 0;
  let ftaEligibleCount = 0;
  for (const c of classifications) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
    confidenceSum += c.confidence;
    if (c.ftaEligible) ftaEligibleCount++;
    const chapter = c.hsCode.replace(/\D/g, "").slice(0, 4);
    if (chapter.length === 4) chapterCounts[chapter] = (chapterCounts[chapter] ?? 0) + 1;
  }

  // Latest estimate per classification (estimates arrive newest-first).
  const seen = new Set<string>();
  let estimatedDutyCents = 0;
  let estimatedLandedCents = 0;
  for (const e of estimates) {
    if (seen.has(e.classificationId)) continue;
    seen.add(e.classificationId);
    estimatedDutyCents += Math.round((e.unitValueCents * e.dutyRateBps) / 10000);
    estimatedLandedCents += e.totalLandedCents;
  }

  const decided = reviews.filter((r) => r.decidedAt);
  const avgTurnaroundHours =
    decided.length > 0
      ? decided.reduce((s, r) => s + (r.decidedAt!.getTime() - r.createdAt.getTime()), 0) /
        decided.length /
        3_600_000
      : null;

  const topChapters = Object.entries(chapterCounts)
    .map(([chapter, count]) => ({ chapter, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalClassified: classifications.length,
    statusCounts,
    ftaEligibleCount,
    avgConfidencePct:
      classifications.length > 0 ? Math.round((confidenceSum / classifications.length) * 100) : 0,
    estimatedDutyCents,
    estimatedLandedCents,
    brokerDecidedCount: decided.length,
    avgTurnaroundHours: avgTurnaroundHours == null ? null : Math.round(avgTurnaroundHours * 10) / 10,
    declarations: {
      draft: declarations.filter((d) => d.status === "DRAFT").length,
      submitted: declarations.filter((d) => d.status === "SUBMITTED").length,
      total: declarations.length,
    },
    topChapters,
  };
}
