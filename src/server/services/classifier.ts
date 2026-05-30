import { prisma } from "@/lib/db";
import { generateHsCode, hashInput } from "@/lib/ai";
import { evaluateFtaEligibility } from "./rules-engine";

const DEFAULT_THRESHOLD = 0.85;

function readThreshold(settings: unknown): number {
  const v = (settings as { confidenceThreshold?: number } | null)?.confidenceThreshold;
  return typeof v === "number" ? v : DEFAULT_THRESHOLD;
}

/**
 * Phase 1: invokes runClassification inline so the tRPC procedure returns terminal state.
 * Phase 2 will replace the body with `inngest.send({ name: "classification/run", data: { classificationId } })`.
 */
export async function scheduleClassification(classificationId: string): Promise<void> {
  await runClassification(classificationId);
}

export async function runClassification(classificationId: string): Promise<void> {
  const c = await prisma.classification.findUnique({
    where: { id: classificationId },
    include: { sku: true },
  });
  if (!c) throw new Error(`Classification ${classificationId} not found`);
  if (c.status !== "PENDING") return;

  const aiInput = {
    skuId: c.skuId,
    title: c.sku.title,
    description: c.sku.description,
    materials: c.sku.materials,
    supplierCountry: c.sku.supplierCountry,
    imageUrls: c.sku.imageUrls,
  };
  const inputHash = hashInput(aiInput);
  const ai = await generateHsCode(aiInput);
  const fta = evaluateFtaEligibility({
    destination: c.destination,
    supplierCountry: c.sku.supplierCountry,
    hsCode: ai.hsCode,
  });

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: c.orgId } });
  const threshold = readThreshold(org.settings);
  const status = ai.confidence >= threshold ? "AUTO_APPROVED" : "NEEDS_REVIEW";

  await prisma.classification.update({
    where: { id: classificationId },
    data: {
      hsCode: ai.hsCode,
      confidence: ai.confidence,
      rationale: ai.rationale,
      modelVersion: ai.modelVersion,
      inputHash,
      status,
      ftaEligible: fta.eligible,
      ftaProgram: fta.program,
    },
  });

  if (status === "NEEDS_REVIEW") {
    // Idempotent: re-running classification on the same row won't duplicate the case.
    await prisma.brokerReview.upsert({
      where: { classificationId },
      create: { classificationId },
      update: {},
    });
  }
}
