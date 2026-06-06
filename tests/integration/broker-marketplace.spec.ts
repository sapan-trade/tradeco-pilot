import { describe, it, expect } from "vitest";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrgWithReview() {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const ownerId = `u_owner_${ts}`;
  const orgId = `org_${ts}`;
  await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@x.local` } });
  await prisma.organization.create({
    // High threshold forces every classification into NEEDS_REVIEW -> spawns a BrokerReview.
    data: { id: orgId, name: `Acme ${ts}`, country: "US", settings: { confidenceThreshold: 0.999 } },
  });
  await prisma.membership.create({ data: { userId: ownerId, orgId, role: "OWNER" } });

  const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
  const sku = await ownerCaller.sku.create({ title: "Men's cotton T-shirt", imageUrls: [], currency: "USD" });
  const run = await ownerCaller.classification.run({ skuId: sku.id, destination: "US" });
  expect(run.status).toBe("NEEDS_REVIEW");
  const review = await prisma.brokerReview.findFirstOrThrow({
    where: { classificationId: run.classificationId },
  });
  return { ownerId, orgId, classificationId: run.classificationId, reviewId: review.id };
}

async function makeUser(prefix: string) {
  seq++;
  const id = `u_${prefix}_${Date.now()}_${seq}`;
  await prisma.user.create({ data: { id, email: `${id}@x.local` } });
  return id;
}

describe("broker marketplace", () => {
  it("apply -> approve -> onboard -> claim -> decide -> earn -> payout", async () => {
    const { ownerId, orgId, reviewId, classificationId } = await seedOrgWithReview();
    const brokerId = await makeUser("broker");
    const adminId = await makeUser("admin");

    const brokerCaller = appRouter.createCaller(createTestContext({ userId: brokerId }));
    const adminCaller = appRouter.createCaller(createTestContext({ userId: adminId, orgId, role: "ADMIN" }));

    // A pending broker cannot touch the marketplace yet.
    await expect(brokerCaller.marketplace.queue()).rejects.toThrow(/Not a registered broker/);

    // Apply.
    const applied = await brokerCaller.brokerPortal.applyAsBroker({
      licenseNumber: "CB-12345",
      licenseCountry: "us",
    });
    expect(applied.status).toBe("PENDING");
    await expect(brokerCaller.marketplace.queue()).rejects.toThrow(/not approved/i);

    // Admin sees the pending application and approves it.
    const pending = await adminCaller.adminBrokers.list({ status: "PENDING" });
    expect(pending.map((b) => b.id)).toContain(applied.id);
    await adminCaller.adminBrokers.approve({ brokerId: applied.id });

    // Onboard to Stripe Connect (stub returns a deterministic link + account id).
    const link = await brokerCaller.brokerPortal.onboardingLink();
    expect(link.url).toContain("stub.local/connect/onboard");
    // Simulate the account.updated webhook flipping payouts on.
    await prisma.broker.update({ where: { id: applied.id }, data: { payoutsEnabled: true } });

    // The pooled queue now shows the (cross-org) review even though the broker is in no org.
    const queue = await brokerCaller.marketplace.queue();
    expect(queue.items.map((i) => i.reviewId)).toContain(reviewId);
    expect(queue.feeCents).toBe(300);

    await brokerCaller.marketplace.claim({ reviewId });
    const decided = await brokerCaller.marketplace.decide({
      reviewId,
      decision: "CORRECTED",
      correctedHsCode: "6109.10.0099",
      notes: "Refined sub-heading",
    });
    expect(decided.classificationStatus).toBe("BROKER_APPROVED");
    expect(decided.earnedCents).toBe(300);

    // Classification reflects the broker's correction.
    const cls = await prisma.classification.findUniqueOrThrow({ where: { id: classificationId } });
    expect(cls.status).toBe("BROKER_APPROVED");
    expect(cls.hsCode).toBe("6109.10.0099");

    // The merchant (org owner) is notified of the broker's decision.
    const ownerCaller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    const beforeRead = await ownerCaller.notification.unreadCount();
    expect(beforeRead).toBeGreaterThanOrEqual(1);
    const feed = await ownerCaller.notification.list({});
    expect(feed.items.some((n) => n.type === "BROKER_DECISION")).toBe(true);
    await ownerCaller.notification.markAllRead();
    expect(await ownerCaller.notification.unreadCount()).toBe(0);

    // Earning accrued as PENDING.
    let me = await brokerCaller.brokerPortal.me();
    expect(me?.earnings.pendingCents).toBe(300);
    expect(me?.earnings.paidCents).toBe(0);

    // Payout transfers the balance and flips the ledger to PAID.
    const payout = await brokerCaller.brokerPortal.requestPayout();
    expect(payout.amountCents).toBe(300);
    expect(payout.transferId).toContain("tr_stub_");

    me = await brokerCaller.brokerPortal.me();
    expect(me?.earnings.pendingCents).toBe(0);
    expect(me?.earnings.paidCents).toBe(300);

    const earning = await prisma.brokerEarning.findUniqueOrThrow({ where: { reviewId } });
    expect(earning.status).toBe("PAID");
    expect(earning.stripeTransferId).toContain("tr_stub_");
  });

  it("a second broker cannot claim or decide a review already claimed", async () => {
    const { reviewId } = await seedOrgWithReview();
    const orgId2 = `org_admin_${Date.now()}_${++seq}`;
    const adminId = await makeUser("admin2");
    await prisma.organization.create({ data: { id: orgId2, name: "Adm", country: "US" } });

    const adminCaller = appRouter.createCaller(createTestContext({ userId: adminId, orgId: orgId2, role: "ADMIN" }));

    async function approvedBroker(prefix: string) {
      const id = await makeUser(prefix);
      const caller = appRouter.createCaller(createTestContext({ userId: id }));
      const b = await caller.brokerPortal.applyAsBroker({ licenseNumber: `CB-${prefix}`, licenseCountry: "US" });
      await adminCaller.adminBrokers.approve({ brokerId: b.id });
      return caller;
    }

    const brokerA = await approvedBroker("a");
    const brokerB = await approvedBroker("b");

    await brokerA.marketplace.claim({ reviewId });
    await expect(brokerB.marketplace.claim({ reviewId })).rejects.toThrow(/another broker/);
    await expect(
      brokerB.marketplace.decide({ reviewId, decision: "APPROVED" })
    ).rejects.toThrow(/another broker/);

    // The rightful claimant can still decide it.
    const out = await brokerA.marketplace.decide({ reviewId, decision: "APPROVED" });
    expect(out.classificationStatus).toBe("BROKER_APPROVED");
  });

  it("applying twice conflicts; requesting payout with no earnings is rejected", async () => {
    const orgId = `org_admin_${Date.now()}_${++seq}`;
    const adminId = await makeUser("admin3");
    await prisma.organization.create({ data: { id: orgId, name: "Adm", country: "US" } });
    const adminCaller = appRouter.createCaller(createTestContext({ userId: adminId, orgId, role: "ADMIN" }));

    const brokerId = await makeUser("dup");
    const caller = appRouter.createCaller(createTestContext({ userId: brokerId }));
    const b = await caller.brokerPortal.applyAsBroker({ licenseNumber: "CB-DUP", licenseCountry: "US" });
    await expect(
      caller.brokerPortal.applyAsBroker({ licenseNumber: "CB-DUP2", licenseCountry: "US" })
    ).rejects.toThrow(/Already applied/);

    await adminCaller.adminBrokers.approve({ brokerId: b.id });
    await prisma.broker.update({ where: { id: b.id }, data: { stripeAccountId: "acct_x", payoutsEnabled: true } });
    await expect(caller.brokerPortal.requestPayout()).rejects.toThrow(/No pending earnings/);
  });
});
