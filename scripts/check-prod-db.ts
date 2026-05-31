import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  const orgs = await prisma.organization.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  const subs = await prisma.subscription.findMany();
  const memberships = await prisma.membership.findMany({ take: 10 });

  console.log("\n=== USERS (latest 5) ===");
  console.table(users.map((u) => ({ id: u.id, email: u.email, name: u.name, created: u.createdAt.toISOString().slice(0, 16) })));

  console.log("\n=== ORGANIZATIONS (latest 5) ===");
  console.table(orgs.map((o) => ({ id: o.id, name: o.name, country: o.country, created: o.createdAt.toISOString().slice(0, 16) })));

  console.log("\n=== SUBSCRIPTIONS (ALL) ===");
  if (subs.length === 0) {
    console.log("(none — Stripe webhook has not written a single Subscription row)");
  } else {
    console.table(subs.map((s) => ({
      orgId: s.orgId,
      tier: s.tier,
      status: s.status,
      stripeCust: s.stripeCustomerId.slice(0, 18),
      stripeSub: (s.stripeSubscriptionId ?? "").slice(0, 18),
    })));
  }

  console.log("\n=== MEMBERSHIPS (sample 10) ===");
  console.table(memberships.map((m) => ({ userId: m.userId.slice(0, 24), orgId: m.orgId.slice(0, 24), role: m.role })));

  console.log("\n=== COUNTS ===");
  console.log(`users=${await prisma.user.count()}  orgs=${await prisma.organization.count()}  subs=${subs.length}  classifications=${await prisma.classification.count()}  skus=${await prisma.sku.count()}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
