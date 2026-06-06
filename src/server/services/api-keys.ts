import crypto from "node:crypto";
import { prisma } from "@/lib/db";

function hash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Create a key. Returns the plaintext ONCE — only its hash is persisted. */
export async function createApiKey(orgId: string, name: string) {
  const raw = `tcp_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 12); // tcp_xxxxxxxx
  const rec = await prisma.apiKey.create({
    data: { orgId, name, prefix, hashedKey: hash(raw) },
  });
  return { id: rec.id, name: rec.name, prefix, key: raw };
}

/** Resolve a raw bearer key to its org. Updates lastUsedAt. Null if invalid/revoked. */
export async function verifyApiKey(raw: string | null): Promise<{ orgId: string; keyId: string } | null> {
  if (!raw || !raw.startsWith("tcp_")) return null;
  const rec = await prisma.apiKey.findUnique({ where: { hashedKey: hash(raw) } });
  if (!rec || rec.revokedAt) return null;
  prisma.apiKey.update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { orgId: rec.orgId, keyId: rec.id };
}

export async function listApiKeys(orgId: string) {
  const keys = await prisma.apiKey.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } });
  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));
}

export async function revokeApiKey(orgId: string, id: string) {
  await prisma.apiKey.updateMany({
    where: { id, orgId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
