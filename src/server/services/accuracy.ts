/**
 * Turns broker decisions into an accuracy signal + a labeled correction dataset —
 * the data flywheel. Accuracy here means "of the low-confidence items a broker
 * reviewed, how often was the AI's code accepted as-is" (APPROVED) vs changed
 * (CORRECTED). It's a conservative, honest metric: it only measures the hard cases
 * the AI flagged, not the high-confidence auto-approvals.
 */

export interface ReviewSignal {
  decision: "APPROVED" | "CORRECTED" | "REJECTED" | null;
  decidedAt: Date | null;
  originalHsCode: string | null;
  correctedHsCode: string | null;
}

export interface Correction {
  from: string;
  to: string;
  decidedAt: string;
}

export interface AccuracySummary {
  decided: number;
  approved: number;
  corrected: number;
  rejected: number;
  /** approved / (approved + corrected); null if no scorable reviews. */
  accuracyPct: number | null;
  byMonth: { month: string; accuracyPct: number; scored: number }[];
  corrections: Correction[];
}

export function computeAccuracy(reviews: ReviewSignal[]): AccuracySummary {
  const decided = reviews.filter((r) => r.decision).length;
  const approved = reviews.filter((r) => r.decision === "APPROVED").length;
  const corrected = reviews.filter((r) => r.decision === "CORRECTED").length;
  const rejected = reviews.filter((r) => r.decision === "REJECTED").length;
  const scorable = approved + corrected;

  const buckets: Record<string, { approved: number; scored: number }> = {};
  for (const r of reviews) {
    if (!r.decidedAt) continue;
    if (r.decision !== "APPROVED" && r.decision !== "CORRECTED") continue;
    const month = r.decidedAt.toISOString().slice(0, 7);
    const b = (buckets[month] ??= { approved: 0, scored: 0 });
    b.scored++;
    if (r.decision === "APPROVED") b.approved++;
  }
  const byMonth = Object.entries(buckets)
    .map(([month, b]) => ({ month, accuracyPct: Math.round((b.approved / b.scored) * 100), scored: b.scored }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const corrections: Correction[] = reviews
    .filter((r) => r.decision === "CORRECTED" && r.originalHsCode && r.correctedHsCode)
    .map((r) => ({ from: r.originalHsCode!, to: r.correctedHsCode!, decidedAt: (r.decidedAt ?? new Date()).toISOString() }));

  return {
    decided,
    approved,
    corrected,
    rejected,
    accuracyPct: scorable > 0 ? Math.round((approved / scorable) * 100) : null,
    byMonth,
    corrections,
  };
}
