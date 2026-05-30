import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Phase 1 has no DB seed data. HS reference is loaded on demand from prisma/seed/hts.json
  // via src/server/integrations/hts.ts. This script exists to keep the npm-script contract
  // stable from day one and verifies DB connectivity.
  await prisma.$queryRaw`SELECT 1`;
  console.log("seed: DB reachable; no rows to insert in Phase 1.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
