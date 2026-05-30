import { describe, it, expect } from "vitest";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrgAndUser(opts: { role?: "OWNER" | "MEMBER" | "BROKER" } = {}) {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const userId = `u_${ts}`;
  const orgId = `org_${ts}`;
  await prisma.user.create({ data: { id: userId, email: `${userId}@x.local` } });
  await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
  await prisma.membership.create({ data: { userId, orgId, role: opts.role ?? "OWNER" } });
  return { userId, orgId };
}

describe("billing router", () => {
  it("returns INACTIVE state when org has no subscription", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));

    const sub = await caller.billing.subscription();
    expect(sub.tier).toBeNull();
    expect(sub.status).toBe("INACTIVE");
    expect(sub.skuAllowance).toBe(0);
    expect(sub.skuUsed).toBe(0);
    expect(sub.currentPeriodEnd).toBeNull();
  });

  it("counts SKUs used", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    await caller.sku.create({ title: "A", imageUrls: [], currency: "USD" });
    await caller.sku.create({ title: "B", imageUrls: [], currency: "USD" });
    const sub = await caller.billing.subscription();
    expect(sub.skuUsed).toBe(2);
  });

  it("returns ACTIVE state once a subscription row exists", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    await prisma.subscription.create({
      data: {
        orgId,
        tier: "STARTER",
        status: "ACTIVE",
        stripeCustomerId: `cust_${orgId}`,
        skuAllowance: 500,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const sub = await caller.billing.subscription();
    expect(sub.tier).toBe("STARTER");
    expect(sub.status).toBe("ACTIVE");
    expect(sub.skuAllowance).toBe(500);
    expect(sub.currentPeriodEnd).toBeTruthy();
  });

  it("checkout returns a URL from the Stripe stub", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const out = await caller.billing.checkout({ tier: "STARTER" });
    expect(out.url).toMatch(/^https:\/\/stub\.local\/checkout/);
    expect(out.url).toContain(`org=${orgId}`);
    expect(out.url).toContain("tier=STARTER");
  });

  it("checkout requires OWNER role", async () => {
    const { userId, orgId } = await seedOrgAndUser({ role: "MEMBER" });
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "MEMBER" }));
    await expect(caller.billing.checkout({ tier: "STARTER" })).rejects.toThrow(/Required role/);
  });

  it("portal requires an existing subscription", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    await expect(caller.billing.portal()).rejects.toThrow(/No active subscription/);
  });

  it("portal returns a URL when subscription exists", async () => {
    const { userId, orgId } = await seedOrgAndUser();
    await prisma.subscription.create({
      data: {
        orgId,
        tier: "PRO",
        status: "ACTIVE",
        stripeCustomerId: `cust_${orgId}`,
        skuAllowance: -1,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const out = await caller.billing.portal();
    expect(out.url).toMatch(/^https:\/\/stub\.local\/portal/);
    expect(out.url).toContain(`customer=cust_${orgId}`);
  });
});
