import { prisma } from "@/lib/db";
import { writeAuditLog } from "./audit";
import { track } from "./telemetry";
import { createStripeClient } from "@/server/integrations/stripe";

const stripe = createStripeClient();

// Only verified classifications may become a customs filing. Drafting off a
// PENDING / NEEDS_REVIEW / BROKER_REJECTED code would file unvetted paperwork.
export const DRAFTABLE_STATUSES = new Set(["AUTO_APPROVED", "BROKER_APPROVED", "OVERRIDDEN"]);

export async function createDeclaration(input: {
  orgId: string;
  userId: string;
  classificationId: string;
  shipmentRef?: string | null;
}) {
  const c = await prisma.classification.findFirst({
    where: { id: input.classificationId, orgId: input.orgId },
    include: { sku: true, estimates: { orderBy: { computedAt: "desc" }, take: 1 } },
  });
  if (!c) throw new Error("Classification not found");
  if (!DRAFTABLE_STATUSES.has(c.status)) {
    throw new Error(`Cannot draft: classification is ${c.status} — it must be approved first`);
  }

  const latestEstimate = c.estimates[0] ?? null;
  const packageJson = {
    classificationId: c.id,
    hsCode: c.hsCode,
    confidence: c.confidence,
    destination: c.destination,
    skuTitle: c.sku.title,
    supplierCountry: c.sku.supplierCountry,
    unitValueCents: c.sku.unitValueCents,
    landedCost: latestEstimate
      ? {
          dutyRateBps: latestEstimate.dutyRateBps,
          vatRateBps: latestEstimate.vatRateBps,
          freightCents: latestEstimate.freightCents,
          feesCents: latestEstimate.feesCents,
          totalLandedCents: latestEstimate.totalLandedCents,
        }
      : null,
    snapshotAt: new Date().toISOString(),
  };

  const declaration = await prisma.declaration.create({
    data: {
      orgId: input.orgId,
      classificationId: c.id,
      destination: c.destination,
      shipmentRef: input.shipmentRef ?? null,
      totalDutyCents: latestEstimate?.totalLandedCents ?? null,
      status: "DRAFT",
      packageJson,
    },
  });

  await writeAuditLog({
    orgId: input.orgId,
    userId: input.userId,
    action: "declaration.create",
    subject: `declaration:${declaration.id}`,
    payload: { classificationId: c.id, hsCode: c.hsCode },
  });
  await track("declaration_drafted", { userId: input.userId, orgId: input.orgId });

  return declaration;
}

export async function submitDeclaration(args: {
  orgId: string;
  userId: string;
  declarationId: string;
}) {
  const d = await prisma.declaration.findFirst({
    where: { id: args.declarationId, orgId: args.orgId },
  });
  if (!d) throw new Error("Declaration not found");
  if (d.status !== "DRAFT") throw new Error(`Cannot submit declaration in status ${d.status}`);

  const updated = await prisma.declaration.update({
    where: { id: d.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  await writeAuditLog({
    orgId: args.orgId,
    userId: args.userId,
    action: "declaration.submit",
    subject: `declaration:${d.id}`,
    payload: { status: "SUBMITTED" },
  });
  await track("declaration_submitted", { userId: args.userId, orgId: args.orgId });

  // Phase 2: meter inline. Production path (Phase 3+) will fire `declaration/submitted`
  // via Inngest so retries are durable and the Stripe call doesn't block the request.
  await recordDeclarationUsage(d.id);

  return updated;
}

export async function recordDeclarationUsage(declarationId: string): Promise<void> {
  const d = await prisma.declaration.findUnique({ where: { id: declarationId } });
  if (!d) return;
  await stripe.recordUsage({ orgId: d.orgId, quantity: 1 });
}
