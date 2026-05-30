import { beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetObjectStoreForTests } from "@/server/integrations/s3";
import { resetRateLimiterForTests } from "@/server/integrations/ratelimit";

const TABLES = [
  "AuditLog",
  "LandedCostEstimate",
  "BrokerReview",
  "Declaration",
  "Classification",
  "ImportJob",
  "Connector",
  "Sku",
  "Subscription",
  "Membership",
  "RegulatoryUpdate",
  "Organization",
  "User",
];

beforeEach(async () => {
  const quoted = TABLES.map((t) => `"${t}"`).join(",");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  resetObjectStoreForTests();
  resetRateLimiterForTests();
});

afterAll(async () => {
  await prisma.$disconnect();
});
