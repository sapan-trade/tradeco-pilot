import { describe, it, expect, afterEach } from "vitest";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { track } from "@/server/services/telemetry";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOwner(email?: string) {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const userId = `u_${ts}`;
  const orgId = `org_${ts}`;
  await prisma.user.create({ data: { id: userId, email: email ?? `${userId}@x.local` } });
  await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
  await prisma.membership.create({ data: { userId, orgId, role: "ADMIN" } });
  return { userId, orgId };
}

const ORIG = process.env.PLATFORM_ADMIN_EMAILS;
afterEach(() => {
  process.env.PLATFORM_ADMIN_EMAILS = ORIG;
});

describe("telemetry + metrics", () => {
  it("track records an event and classify emits one", async () => {
    const { userId, orgId } = await seedOwner();
    await track("test_event", { userId, orgId, props: { a: 1 } });
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const sku = await caller.sku.create({ title: "Widget", imageUrls: [], currency: "USD" });
    await caller.classification.run({ skuId: sku.id, destination: "US" });

    const names = (await prisma.analyticsEvent.findMany({ where: { orgId } })).map((e) => e.name);
    expect(names).toContain("test_event");
    expect(names).toContain("sku_created");
    expect(names).toContain("classification_run");
  });

  it("metrics.overview is gated to PLATFORM_ADMIN_EMAILS", async () => {
    const { userId, orgId } = await seedOwner("ceo@acme.test");
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "ADMIN" }));

    process.env.PLATFORM_ADMIN_EMAILS = "";
    await expect(caller.metrics.overview()).rejects.toThrow(/Platform admin only/);

    process.env.PLATFORM_ADMIN_EMAILS = "ceo@acme.test";
    const m = await caller.metrics.overview();
    expect(m.orgs).toBeGreaterThanOrEqual(1);
    expect(typeof m.activationRate).toBe("number");
  });
});
