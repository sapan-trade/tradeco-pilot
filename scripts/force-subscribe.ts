import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const orgId = process.argv[2];
  const tier = (process.argv[3] ?? "STARTER") as "STARTER" | "GROWTH" | "PRO";
  if (!orgId) throw new Error("usage: tsx scripts/force-subscribe.ts <orgId> [STARTER|GROWTH|PRO]");

  const allowance = tier === "STARTER" ? 500 : tier === "GROWTH" ? 5000 : -1;
  const sub = await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      tier,
      status: "ACTIVE",
      stripeCustomerId: `manual_${orgId}`,
      stripeSubscriptionId: `manual_sub_${orgId}`,
      skuAllowance: allowance,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: { tier, status: "ACTIVE", skuAllowance: allowance },
  });
  console.log("Subscription upserted:", sub);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
