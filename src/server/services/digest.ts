import { prisma } from "@/lib/db";
import { computeAnalytics, type AnalyticsSummary } from "./analytics";
import { matchUpdatesToClassifications } from "./regulatory-match";
import { createNotification } from "./notify";

const RECENT_DAYS = 7;

function buildDigest(
  orgName: string,
  s: AnalyticsSummary,
  alertCount: number,
  affectedSkuCount: number
): { title: string; body: string } {
  const lines = [`This week at ${orgName}:`];
  lines.push(`• ${s.totalClassified} products classified (avg confidence ${s.avgConfidencePct}%)`);
  lines.push(`• Estimated duty exposure: $${(s.estimatedDutyCents / 100).toFixed(2)}`);
  if (s.ftaEligibleCount > 0) lines.push(`• ${s.ftaEligibleCount} FTA-eligible classification(s)`);
  const needsReview = s.statusCounts["NEEDS_REVIEW"] ?? 0;
  if (needsReview > 0) lines.push(`• ${needsReview} awaiting broker review`);
  if (alertCount > 0) {
    lines.push(`• ⚠ ${alertCount} regulatory change(s) affecting ${affectedSkuCount} of your products`);
  }
  lines.push("", "See the full picture: /analytics");
  return { title: "Your weekly trade summary", body: lines.join("\n") };
}

/**
 * Weekly per-org summary -> in-app notification + (stubbed) email to each member.
 * Skips orgs with no classifications so we never email an empty account.
 */
export async function sendWeeklyDigests(): Promise<{ orgsNotified: number; usersNotified: number }> {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  let orgsNotified = 0;
  let usersNotified = 0;

  for (const org of orgs) {
    const [classifications, reviews, declarations, estimates, recentUpdates, members] = await Promise.all([
      prisma.classification.findMany({
        where: { orgId: org.id },
        select: { status: true, confidence: true, hsCode: true, ftaEligible: true, skuId: true, destination: true },
      }),
      prisma.brokerReview.findMany({
        where: { classification: { orgId: org.id }, decision: { not: null } },
        select: { createdAt: true, decidedAt: true },
      }),
      prisma.declaration.findMany({ where: { orgId: org.id }, select: { status: true } }),
      prisma.landedCostEstimate.findMany({
        where: { orgId: org.id },
        select: { classificationId: true, dutyRateBps: true, unitValueCents: true, totalLandedCents: true },
        orderBy: { computedAt: "desc" },
      }),
      prisma.regulatoryUpdate.findMany({ where: { publishedAt: { gte: since } }, orderBy: { publishedAt: "desc" }, take: 100 }),
      prisma.membership.findMany({ where: { orgId: org.id }, select: { userId: true } }),
    ]);

    if (classifications.length === 0 || members.length === 0) continue;

    const summary = computeAnalytics({
      classifications: classifications.map((c) => ({
        status: c.status,
        confidence: c.confidence,
        hsCode: c.hsCode,
        ftaEligible: c.ftaEligible,
      })),
      reviews,
      declarations,
      estimates,
    });
    const matches = matchUpdatesToClassifications(
      recentUpdates,
      classifications.map((c) => ({ id: c.skuId, skuId: c.skuId, hsCode: c.hsCode, destination: c.destination, skuTitle: "" }))
    );
    const affectedSku = new Set<string>();
    matches.forEach((m) => m.affected.forEach((c) => affectedSku.add(c.skuId)));

    const { title, body } = buildDigest(org.name, summary, matches.length, affectedSku.size);
    for (const m of members) {
      await createNotification(m.userId, { type: "GENERAL", title, body, link: "/analytics", orgId: org.id });
      usersNotified++;
    }
    orgsNotified++;
  }

  return { orgsNotified, usersNotified };
}
