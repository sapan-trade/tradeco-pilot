import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.stripeWebhookDebug.findMany({
    orderBy: { receivedAt: "desc" },
    take: 20,
  });
  console.log(`\n=== STRIPE WEBHOOK DEBUG (latest ${rows.length}) ===\n`);
  if (rows.length === 0) {
    console.log("(none — no webhooks have reached the endpoint since debug was deployed)");
  } else {
    for (const r of rows) {
      console.log(`[${r.receivedAt.toISOString().slice(11, 19)}] type=${r.eventType}  sig=${r.signatureOk ? "OK" : "FAIL"}  processed=${r.processedOk ? "OK" : "FAIL"}  orgId=${r.orgIdSeen ?? "(none)"}  err=${r.errorMsg ?? "-"}`);
      if (r.bodySnippet && r.errorMsg) {
        console.log(`  body (first 200 chars): ${r.bodySnippet.slice(0, 200)}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
