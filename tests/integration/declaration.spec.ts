import { describe, it, expect } from "vitest";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrgAndUser() {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const userId = `u_${ts}`;
  const orgId = `org_${ts}`;
  await prisma.user.create({ data: { id: userId, email: `${userId}@x.local` } });
  await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
  await prisma.membership.create({ data: { userId, orgId, role: "OWNER" } });
  return { userId, orgId };
}

describe("declaration lifecycle", () => {
  it("estimates landed cost, creates DRAFT, submits, and writes audit chain", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));

    const sku = await caller.sku.create({
      title: "Men's cotton T-shirt",
      description: "100% cotton knit tee",
      imageUrls: [],
      supplierCountry: "MX",
      unitValueCents: 1500,
      currency: "USD",
    });
    const cls = await caller.classification.run({ skuId: sku.id, destination: "US" });

    const est = await caller.landedCost.estimate({ classificationId: cls.classificationId });
    expect(est.dutyRateBps).toBe(1660);
    expect(est.unitValueCents).toBe(1500);
    expect(est.totalLandedCents).toBeGreaterThan(1500);
    const recomputed =
      est.unitValueCents +
      Math.round((est.unitValueCents * est.dutyRateBps) / 10000) +
      Math.round(
        ((est.unitValueCents +
          Math.round((est.unitValueCents * est.dutyRateBps) / 10000) +
          est.freightCents) *
          est.vatRateBps) /
          10000
      ) +
      est.freightCents +
      est.feesCents;
    expect(est.totalLandedCents).toBe(recomputed);

    const draft = await caller.declaration.create({
      classificationId: cls.classificationId,
      shipmentRef: "SHIP-001",
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.shipmentRef).toBe("SHIP-001");
    expect(draft.submittedAt).toBeNull();

    const submitted = await caller.declaration.submit({ id: draft.id });
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submittedAt).toBeTruthy();

    const audits = await prisma.auditLog.findMany({
      where: { orgId, subject: `declaration:${draft.id}` },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((a) => a.action)).toEqual(["declaration.create", "declaration.submit"]);

    let prev: string | null = null;
    const allAudits = await prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    });
    for (const row of allAudits) {
      expect(row.prevHash).toBe(prev);
      prev = row.hash;
    }
  });

  it("rejects submit of non-DRAFT declaration", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const sku = await caller.sku.create({
      title: "Smartphone X",
      description: "5G mobile phone",
      imageUrls: [],
      unitValueCents: 80000,
      currency: "USD",
    });
    const cls = await caller.classification.run({ skuId: sku.id, destination: "US" });
    const d = await caller.declaration.create({ classificationId: cls.classificationId });
    await caller.declaration.submit({ id: d.id });
    await expect(caller.declaration.submit({ id: d.id })).rejects.toThrow(/Cannot submit/);
  });

  it("rejects access to a declaration owned by another org", async () => {
    const a = await seedOrgAndUser();
    const b = await seedOrgAndUser();
    const callerA = appRouter.createCaller(createTestContext({ userId: a.userId, orgId: a.orgId, role: "OWNER" }));
    const sku = await callerA.sku.create({
      title: "Ceramic mug",
      description: "porcelain coffee mug",
      imageUrls: [],
      currency: "USD",
    });
    const cls = await callerA.classification.run({ skuId: sku.id, destination: "US" });
    const d = await callerA.declaration.create({ classificationId: cls.classificationId });

    const callerB = appRouter.createCaller(createTestContext({ userId: b.userId, orgId: b.orgId, role: "OWNER" }));
    await expect(callerB.declaration.submit({ id: d.id })).rejects.toThrow();
    await expect(callerB.declaration.get({ id: d.id })).rejects.toThrow();
  });

  it("get returns the snapshot packageJson", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const sku = await caller.sku.create({
      title: "Ceramic mug",
      description: "porcelain coffee mug",
      imageUrls: [],
      supplierCountry: "MX",
      unitValueCents: 800,
      currency: "USD",
    });
    const cls = await caller.classification.run({ skuId: sku.id, destination: "US" });
    await caller.landedCost.estimate({ classificationId: cls.classificationId });
    const d = await caller.declaration.create({ classificationId: cls.classificationId });

    const fetched = await caller.declaration.get({ id: d.id });
    expect(fetched.packageJson).toBeDefined();
    const pkg = fetched.packageJson as any;
    expect(pkg.hsCode).toBe("6911.10.4100");
    expect(pkg.skuTitle).toBe("Ceramic mug");
    expect(pkg.landedCost).not.toBeNull();
  });
});
