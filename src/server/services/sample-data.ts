import { prisma } from "@/lib/db";
import { estimateLandedCost } from "./landed-cost";

/**
 * Pre-classified demo products so a brand-new org sees the workflow immediately
 * instead of empty tables. Inserts directly (no AI call) using known catalog codes,
 * so it's free and instant. SKUs are tagged source="sample" so it stays idempotent.
 */
const SAMPLES = [
  {
    title: "Men's cotton crew-neck t-shirt",
    description: "100% combed cotton single-jersey knit tee",
    supplierCountry: "VN",
    unitValueCents: 899,
    hsCode: "6109.10.0010",
  },
  {
    title: "Men's cotton chino trousers",
    description: "Woven cotton flat-front trousers, not knitted",
    supplierCountry: "BD",
    unitValueCents: 2499,
    hsCode: "6203.42.1000",
  },
  {
    title: "Knit beanie hat",
    description: "Acrylic knit winter beanie / headgear",
    supplierCountry: "CN",
    unitValueCents: 1200,
    hsCode: "6505.00.4000",
  },
];

export async function seedSampleData(orgId: string): Promise<{ created: number }> {
  const existing = await prisma.sku.count({ where: { orgId, source: "sample" } });
  if (existing > 0) return { created: 0 };

  let created = 0;
  for (const s of SAMPLES) {
    const sku = await prisma.sku.create({
      data: {
        orgId,
        source: "sample",
        title: s.title,
        description: s.description,
        imageUrls: [],
        supplierCountry: s.supplierCountry,
        unitValueCents: s.unitValueCents,
        currency: "USD",
      },
    });
    const classification = await prisma.classification.create({
      data: {
        orgId,
        skuId: sku.id,
        destination: "US",
        hsCode: s.hsCode,
        confidence: 0.93,
        rationale: "Sample data — pre-classified to demonstrate the workflow.",
        modelVersion: "sample",
        inputHash: "sample",
        status: "AUTO_APPROVED",
      },
    });
    // Attach a landed-cost estimate so /declarations and /analytics show real numbers.
    await estimateLandedCost({ orgId, classificationId: classification.id });
    created++;
  }
  return { created };
}
