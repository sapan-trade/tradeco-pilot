import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
