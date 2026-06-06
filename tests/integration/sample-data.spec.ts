import { describe, it, expect } from "vitest";
import { seedSampleData } from "@/server/services/sample-data";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrg() {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const orgId = `org_${ts}`;
  await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
  return orgId;
}

describe("sample data onboarding", () => {
  it("creates pre-classified demo products with landed-cost estimates", async () => {
    const orgId = await seedOrg();
    const r = await seedSampleData(orgId);
    expect(r.created).toBe(3);

    const skus = await prisma.sku.findMany({ where: { orgId, source: "sample" } });
    expect(skus.length).toBe(3);

    const classifications = await prisma.classification.findMany({ where: { orgId } });
    expect(classifications.length).toBe(3);
    expect(classifications.every((c) => c.status === "AUTO_APPROVED")).toBe(true);

    const estimates = await prisma.landedCostEstimate.findMany({ where: { orgId } });
    expect(estimates.length).toBe(3);
    expect(estimates.every((e) => e.totalLandedCents > 0)).toBe(true);
  });

  it("is idempotent — re-running does not duplicate", async () => {
    const orgId = await seedOrg();
    await seedSampleData(orgId);
    const second = await seedSampleData(orgId);
    expect(second.created).toBe(0);
    expect(await prisma.sku.count({ where: { orgId } })).toBe(3);
  });
});
