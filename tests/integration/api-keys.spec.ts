import { describe, it, expect } from "vitest";
import { createApiKey, verifyApiKey, revokeApiKey, listApiKeys } from "@/server/services/api-keys";
import { classifyViaApi } from "@/server/services/api-classify";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrg() {
  seq++;
  const orgId = `org_${Date.now()}_${seq}`;
  await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
  return orgId;
}

describe("API keys + public classify", () => {
  it("creates a verifiable key, revokes it, and never returns the plaintext again", async () => {
    const orgId = await seedOrg();
    const created = await createApiKey(orgId, "Prod");
    expect(created.key).toMatch(/^tcp_[a-f0-9]{48}$/);

    const verified = await verifyApiKey(created.key);
    expect(verified?.orgId).toBe(orgId);
    expect(await verifyApiKey("tcp_bogus")).toBeNull();

    // list never exposes the raw key
    const listed = await listApiKeys(orgId);
    expect(listed[0]).not.toHaveProperty("key");
    expect(listed[0].prefix).toBe(created.key.slice(0, 12));

    await revokeApiKey(orgId, created.id);
    expect(await verifyApiKey(created.key)).toBeNull();
  });

  it("classifyViaApi creates an api-sourced SKU + classification", async () => {
    const orgId = await seedOrg();
    const r = await classifyViaApi(orgId, { title: "Men's cotton T-shirt", destination: "US" });
    expect(r.hsCode).not.toBe("0000.00.0000");
    expect(["AUTO_APPROVED", "NEEDS_REVIEW"]).toContain(r.status);

    const sku = await prisma.sku.findUniqueOrThrow({ where: { id: r.skuId } });
    expect(sku.source).toBe("api");
  });
});
