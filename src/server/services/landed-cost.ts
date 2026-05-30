import { prisma } from "@/lib/db";
import { lookupDutyRateBps } from "@/server/integrations/hts";

const VAT_RATES_BPS: Record<string, number> = {
  US: 0,
  GB: 2000,
  DE: 1900,
  FR: 2000,
  IT: 2200,
  ES: 2100,
  CA: 500,
  MX: 1600,
  JP: 1000,
  AU: 1000,
};

const DEFAULT_FREIGHT_PER_UNIT_CENTS = 250;
const DEFAULT_FEES_CENTS = 1000;

export async function estimateLandedCost(args: {
  orgId: string;
  classificationId: string;
}) {
  const c = await prisma.classification.findFirst({
    where: { id: args.classificationId, orgId: args.orgId },
    include: { sku: true },
  });
  if (!c) throw new Error("Classification not found");

  const unitValueCents = c.sku.unitValueCents ?? 0;
  const dutyRateBps = lookupDutyRateBps(c.hsCode);
  const vatRateBps = VAT_RATES_BPS[c.destination] ?? 0;
  const freightCents = DEFAULT_FREIGHT_PER_UNIT_CENTS;
  const feesCents = DEFAULT_FEES_CENTS;

  const dutyCents = Math.round((unitValueCents * dutyRateBps) / 10000);
  const vatBase = unitValueCents + dutyCents + freightCents;
  const vatCents = Math.round((vatBase * vatRateBps) / 10000);
  const totalLandedCents = unitValueCents + dutyCents + vatCents + freightCents + feesCents;

  return prisma.landedCostEstimate.create({
    data: {
      orgId: args.orgId,
      classificationId: c.id,
      destination: c.destination,
      dutyRateBps,
      vatRateBps,
      freightCents,
      feesCents,
      unitValueCents,
      totalLandedCents,
    },
  });
}
