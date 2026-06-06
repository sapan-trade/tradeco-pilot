import { prisma } from "@/lib/db";
import { writeAuditLog } from "./audit";
import { scheduleClassification } from "./classifier";
import { track } from "./telemetry";

export interface ApiClassifyInput {
  title: string;
  description?: string | null;
  supplierCountry?: string | null;
  unitValueCents?: number | null;
  destination?: string;
}

/**
 * Programmatic create-and-classify for the public API. Bypasses tRPC auth procedures
 * (the caller is an API key, not a user session) and audits with userId=null.
 */
export async function classifyViaApi(orgId: string, input: ApiClassifyInput) {
  const destination = (input.destination ?? "US").slice(0, 2).toUpperCase();
  const sku = await prisma.sku.create({
    data: {
      orgId,
      source: "api",
      title: input.title,
      description: input.description ?? null,
      imageUrls: [],
      supplierCountry: input.supplierCountry && input.supplierCountry.length === 2 ? input.supplierCountry.toUpperCase() : null,
      unitValueCents: input.unitValueCents ?? null,
      currency: "USD",
    },
  });
  const classification = await prisma.classification.create({
    data: {
      orgId,
      skuId: sku.id,
      destination,
      hsCode: "0000.00.0000",
      confidence: 0,
      rationale: "",
      modelVersion: "pending",
      inputHash: "",
      status: "PENDING",
    },
  });
  await writeAuditLog({
    orgId,
    userId: null,
    action: "api.classify",
    subject: `classification:${classification.id}`,
    payload: { skuId: sku.id, destination },
  });
  await scheduleClassification(classification.id);
  await track("api_classify", { orgId });

  const updated = await prisma.classification.findUniqueOrThrow({
    where: { id: classification.id },
    select: { hsCode: true, confidence: true, rationale: true, status: true },
  });
  return {
    skuId: sku.id,
    classificationId: classification.id,
    destination,
    hsCode: updated.hsCode,
    confidence: updated.confidence,
    status: updated.status,
    rationale: updated.rationale,
  };
}
