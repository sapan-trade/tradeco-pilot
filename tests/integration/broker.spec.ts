import { describe, it, expect } from "vitest";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { prisma } from "@/lib/db";

let seq = 0;
async function seed() {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const ownerId = `u_owner_${ts}`;
  const brokerId = `u_broker_${ts}`;
  const orgId = `org_${ts}`;
  await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@x.local` } });
  await prisma.user.create({ data: { id: brokerId, email: `${brokerId}@x.local` } });
  await prisma.organization.create({
    data: { id: orgId, name: "Acme", country: "US", settings: { confidenceThreshold: 0.999 } },
  });
  await prisma.membership.create({ data: { userId: ownerId, orgId, role: "OWNER" } });
  await prisma.membership.create({ data: { userId: brokerId, orgId, role: "BROKER" } });
  return { ownerId, brokerId, orgId };
}

describe("broker review flow", () => {
  it("creates BrokerReview when NEEDS_REVIEW and broker can correct HS code", async () => {
    const { ownerId, brokerId, orgId } = await seed();
    const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));

    const sku = await ownerCaller.sku.create({
      title: "Men's cotton T-shirt",
      description: "100% cotton knit tee",
      materials: [{ material: "cotton", pct: 100 }],
      imageUrls: [],
      currency: "USD",
    });
    const run = await ownerCaller.classification.run({ skuId: sku.id, destination: "US" });
    expect(run.status).toBe("NEEDS_REVIEW");

    const reviews = await prisma.brokerReview.findMany({ where: { classificationId: run.classificationId } });
    expect(reviews.length).toBe(1);
    expect(reviews[0].brokerUserId).toBeNull();
    expect(reviews[0].decision).toBeNull();

    const brokerCaller = appRouter.createCaller(createTestContext({ userId: brokerId, orgId, role: "BROKER" }));
    const queue = await brokerCaller.broker.queue();
    expect(queue.items.map((i) => i.reviewId)).toContain(reviews[0].id);

    const decision = await brokerCaller.broker.decide({
      reviewId: reviews[0].id,
      decision: "CORRECTED",
      correctedHsCode: "6109.10.0099",
      notes: "Refined to better sub-heading",
    });
    expect(decision.classificationStatus).toBe("BROKER_APPROVED");

    const detail = await ownerCaller.classification.get({ id: run.classificationId });
    expect(detail.status).toBe("BROKER_APPROVED");
    expect(detail.hsCode).toBe("6109.10.0099");

    const updated = await prisma.brokerReview.findUnique({ where: { id: reviews[0].id } });
    expect(updated?.brokerUserId).toBe(brokerId);
    expect(updated?.decision).toBe("CORRECTED");
    expect(updated?.correctedHsCode).toBe("6109.10.0099");

    const audits = await prisma.auditLog.findMany({
      where: { subject: `classification:${run.classificationId}` },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((a) => a.action)).toContain("broker.decide");
  });

  it("APPROVED leaves HS code unchanged", async () => {
    const { ownerId, brokerId, orgId } = await seed();
    const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    const sku = await ownerCaller.sku.create({
      title: "Smartphone Model X",
      description: "5G mobile phone",
      imageUrls: [],
      currency: "USD",
    });
    const run = await ownerCaller.classification.run({ skuId: sku.id, destination: "US" });
    expect(run.status).toBe("NEEDS_REVIEW");

    const review = await prisma.brokerReview.findFirstOrThrow({
      where: { classificationId: run.classificationId },
    });
    const brokerCaller = appRouter.createCaller(createTestContext({ userId: brokerId, orgId, role: "BROKER" }));
    const out = await brokerCaller.broker.decide({ reviewId: review.id, decision: "APPROVED" });
    expect(out.classificationStatus).toBe("BROKER_APPROVED");

    const detail = await ownerCaller.classification.get({ id: run.classificationId });
    expect(detail.hsCode).toBe("8517.13.0000");
  });

  it("REJECTED transitions classification to BROKER_REJECTED", async () => {
    const { ownerId, brokerId, orgId } = await seed();
    const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    const sku = await ownerCaller.sku.create({ title: "Foo Bar Widget", imageUrls: [], currency: "USD" });
    const run = await ownerCaller.classification.run({ skuId: sku.id, destination: "US" });
    expect(run.status).toBe("NEEDS_REVIEW");

    const review = await prisma.brokerReview.findFirstOrThrow({
      where: { classificationId: run.classificationId },
    });
    const brokerCaller = appRouter.createCaller(createTestContext({ userId: brokerId, orgId, role: "BROKER" }));
    const out = await brokerCaller.broker.decide({
      reviewId: review.id,
      decision: "REJECTED",
      notes: "Insufficient product info",
    });
    expect(out.classificationStatus).toBe("BROKER_REJECTED");
  });

  it("CORRECTED without correctedHsCode is rejected", async () => {
    const { ownerId, brokerId, orgId } = await seed();
    const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    const sku = await ownerCaller.sku.create({ title: "Foo Bar Widget", imageUrls: [], currency: "USD" });
    const run = await ownerCaller.classification.run({ skuId: sku.id, destination: "US" });
    const review = await prisma.brokerReview.findFirstOrThrow({
      where: { classificationId: run.classificationId },
    });
    const brokerCaller = appRouter.createCaller(createTestContext({ userId: brokerId, orgId, role: "BROKER" }));
    await expect(
      brokerCaller.broker.decide({ reviewId: review.id, decision: "CORRECTED" })
    ).rejects.toThrow(/correctedHsCode required/);
  });

  it("double-decide is rejected with CONFLICT", async () => {
    const { ownerId, brokerId, orgId } = await seed();
    const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    const sku = await ownerCaller.sku.create({ title: "Foo Bar Widget", imageUrls: [], currency: "USD" });
    const run = await ownerCaller.classification.run({ skuId: sku.id, destination: "US" });
    const review = await prisma.brokerReview.findFirstOrThrow({
      where: { classificationId: run.classificationId },
    });
    const brokerCaller = appRouter.createCaller(createTestContext({ userId: brokerId, orgId, role: "BROKER" }));
    await brokerCaller.broker.decide({ reviewId: review.id, decision: "APPROVED" });
    await expect(
      brokerCaller.broker.decide({ reviewId: review.id, decision: "APPROVED" })
    ).rejects.toThrow(/already decided/);
  });

  it("non-BROKER role cannot access broker.queue", async () => {
    const { ownerId, orgId } = await seed();
    const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    await expect(ownerCaller.broker.queue()).rejects.toThrow(/Required role/);
  });
});
