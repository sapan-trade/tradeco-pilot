import { describe, it, expect } from "vitest";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrg() {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const userId = `u_${ts}`;
  const orgId = `org_${ts}`;
  await prisma.user.create({ data: { id: userId, email: `${userId}@x.local` } });
  await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
  await prisma.membership.create({ data: { userId, orgId, role: "OWNER" } });
  return { userId, orgId };
}

describe("usage metering", () => {
  it("submitting a declaration records a billable unit in the ledger", async () => {
    const { userId, orgId } = await seedOrg();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));

    const before = await caller.billing.usage();
    expect(before.used).toBe(0);

    const sku = await caller.sku.create({
      title: "Men's cotton T-shirt",
      description: "100% cotton knit tee",
      imageUrls: [],
      unitValueCents: 1500,
      currency: "USD",
    });
    const cls = await caller.classification.run({ skuId: sku.id, destination: "US" });
    expect(cls.status).toBe("AUTO_APPROVED");
    const draft = await caller.declaration.create({ classificationId: cls.classificationId });
    await caller.declaration.submit({ id: draft.id });

    const records = await prisma.usageRecord.findMany({ where: { orgId } });
    expect(records.length).toBe(1);
    expect(records[0].kind).toBe("declaration");

    const after = await caller.billing.usage();
    expect(after.used).toBe(1);
  });
});
