import { describe, it, expect } from "vitest";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrgAndUser(opts: { role?: "OWNER" | "MEMBER" | "BROKER" | "ADMIN" } = {}) {
  seq++;
  const userId = `user_${Date.now()}_${seq}`;
  const orgId = `org_${Date.now()}_${seq}`;
  const user = await prisma.user.create({
    data: { id: userId, email: `${userId}@test.local`, name: "Test User" },
  });
  const org = await prisma.organization.create({
    data: { id: orgId, name: "Test Org", country: "US" },
  });
  await prisma.membership.create({
    data: { userId: user.id, orgId: org.id, role: opts.role ?? "OWNER" },
  });
  return { user, org };
}

describe("classification end-to-end", () => {
  it("creates SKU, runs classification, returns 10-digit HS code with audit chain", async () => {
    const { user, org } = await seedOrgAndUser();
    const ctx = createTestContext({ userId: user.id, orgId: org.id, role: "OWNER" });
    const caller = appRouter.createCaller(ctx);

    const sku = await caller.sku.create({
      title: "Men's cotton T-shirt",
      description: "100% cotton knit tee, regular fit",
      materials: [{ material: "cotton", pct: 100 }],
      imageUrls: [],
      supplierCountry: "VN",
      unitValueCents: 1500,
      currency: "USD",
    });
    expect(sku.id).toBeTruthy();
    expect(sku.title).toBe("Men's cotton T-shirt");

    const run = await caller.classification.run({ skuId: sku.id, destination: "US" });
    expect(run.classificationId).toBeTruthy();
    expect(["AUTO_APPROVED", "NEEDS_REVIEW"]).toContain(run.status);

    const detail = await caller.classification.get({ id: run.classificationId });
    expect(detail.hsCode).toMatch(/^\d{4}\.\d{2}\.\d{4}$/);
    expect(detail.confidence).toBeGreaterThan(0);
    expect(detail.confidence).toBeLessThanOrEqual(1);
    expect(detail.modelVersion).toBe("stub-v0");
    expect(detail.rationale.length).toBeGreaterThan(0);
    expect(detail.audit.length).toBeGreaterThanOrEqual(1);

    const audits = await prisma.auditLog.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2); // sku.create + classification.run
    let prev: string | null = null;
    for (const row of audits) {
      expect(row.prevHash).toBe(prev);
      expect(row.hash).toMatch(/^[0-9a-f]{64}$/);
      prev = row.hash;
    }
  });

  it("classifier is deterministic for the same input", async () => {
    const { user, org } = await seedOrgAndUser();
    const ctx = createTestContext({ userId: user.id, orgId: org.id, role: "OWNER" });
    const caller = appRouter.createCaller(ctx);

    const a = await caller.sku.create({
      title: "Smartphone Model X",
      description: "5G mobile phone, 128GB",
      imageUrls: [],
      currency: "USD",
    });
    const b = await caller.sku.create({
      title: "Smartphone Model X",
      description: "5G mobile phone, 128GB",
      imageUrls: [],
      currency: "USD",
    });

    const runA = await caller.classification.run({ skuId: a.id, destination: "US" });
    const runB = await caller.classification.run({ skuId: b.id, destination: "US" });

    const dA = await caller.classification.get({ id: runA.classificationId });
    const dB = await caller.classification.get({ id: runB.classificationId });

    expect(dA.hsCode).toBe(dB.hsCode);
    expect(dA.hsCode).toBe("8517.13.0000");
  });

  it("rejects classifying a SKU owned by another org", async () => {
    const a = await seedOrgAndUser();
    const b = await seedOrgAndUser();

    const callerA = appRouter.createCaller(
      createTestContext({ userId: a.user.id, orgId: a.org.id, role: "OWNER" })
    );
    const sku = await callerA.sku.create({
      title: "Ceramic mug",
      description: "porcelain coffee mug",
      imageUrls: [],
      currency: "USD",
    });

    const callerB = appRouter.createCaller(
      createTestContext({ userId: b.user.id, orgId: b.org.id, role: "OWNER" })
    );
    await expect(
      callerB.classification.run({ skuId: sku.id, destination: "US" })
    ).rejects.toThrow(/SKU not found/);
  });

  it("rejects unauthenticated calls", async () => {
    const callerNoAuth = appRouter.createCaller(createTestContext({}));
    await expect(callerNoAuth.sku.create({ title: "x", imageUrls: [], currency: "USD" })).rejects.toThrow();
  });

  it("evaluates FTA eligibility for USMCA supplier", async () => {
    const { user, org } = await seedOrgAndUser();
    const caller = appRouter.createCaller(
      createTestContext({ userId: user.id, orgId: org.id, role: "OWNER" })
    );

    const sku = await caller.sku.create({
      title: "Ceramic mug",
      description: "porcelain coffee mug",
      imageUrls: [],
      supplierCountry: "MX",
      currency: "USD",
    });
    const run = await caller.classification.run({ skuId: sku.id, destination: "US" });
    const detail = await caller.classification.get({ id: run.classificationId });
    expect(detail.ftaEligible).toBe(true);
    expect(detail.ftaProgram).toBe("USMCA");
  });
});
