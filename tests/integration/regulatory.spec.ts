import { describe, it, expect } from "vitest";
import { ingestRegulatoryUpdates } from "@/inngest/functions/ingest-regulatory";
import {
  extractHsCodes,
  inferSeverity,
  type FederalRegisterFetcher,
  type FederalRegisterEntry,
} from "@/server/integrations/federal-register";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { prisma } from "@/lib/db";

function fixtureFetcher(entries: FederalRegisterEntry[]): FederalRegisterFetcher {
  return {
    async fetchSince() {
      return { entries };
    },
  };
}

const FIXTURE: FederalRegisterEntry[] = [
  {
    id: "2027-12345",
    title: "Notice of Modification of Section 301 Tariffs",
    url: "https://www.federalregister.gov/documents/2027/01/15/2027-12345",
    publishedAt: new Date("2027-01-15"),
    affectedHs: ["8517"],
    affectedDest: ["US"],
    severity: "WARN",
  },
  {
    id: "2027-67890",
    title: "Withdrawal of Antidumping Duty Order",
    url: "https://www.federalregister.gov/documents/2027/01/16/2027-67890",
    publishedAt: new Date("2027-01-16"),
    affectedHs: [],
    affectedDest: ["US"],
    severity: "INFO",
  },
];

describe("regulatory ingest", () => {
  it("inserts entries from fetcher", async () => {
    const r = await ingestRegulatoryUpdates(fixtureFetcher(FIXTURE));
    expect(r.inserted).toBe(2);
    expect(r.updated).toBe(0);

    const rows = await prisma.regulatoryUpdate.findMany({
      where: { source: "federal_register" },
      orderBy: { publishedAt: "asc" },
    });
    expect(rows.length).toBe(2);
    expect(rows[0].externalId).toBe("2027-12345");
    expect(rows[0].severity).toBe("WARN");
    expect(rows[1].externalId).toBe("2027-67890");
  });

  it("is idempotent on re-run with the same entries", async () => {
    await ingestRegulatoryUpdates(fixtureFetcher(FIXTURE));
    const r2 = await ingestRegulatoryUpdates(fixtureFetcher(FIXTURE));
    expect(r2.inserted).toBe(0);
    expect(r2.updated).toBe(2);
    const rows = await prisma.regulatoryUpdate.findMany({
      where: { source: "federal_register" },
    });
    expect(rows.length).toBe(2);
  });

  it("updates title when the same externalId reappears with a changed title", async () => {
    await ingestRegulatoryUpdates(fixtureFetcher(FIXTURE));
    const modified: FederalRegisterEntry[] = [
      { ...FIXTURE[0], title: "REVISED: Section 301 Tariff Modification" },
    ];
    const r = await ingestRegulatoryUpdates(fixtureFetcher(modified));
    expect(r.updated).toBe(1);
    const row = await prisma.regulatoryUpdate.findFirstOrThrow({
      where: { source: "federal_register", externalId: "2027-12345" },
    });
    expect(row.title).toBe("REVISED: Section 301 Tariff Modification");
  });
});

describe("regulatory feed extraction", () => {
  it("extracts dotted HS codes and ignores bare years", () => {
    const codes = extractHsCodes("In 2027, subheading 8517.62 and 6109.10.0010 are modified.");
    expect(codes).toContain("8517.62");
    expect(codes).toContain("6109.10.0010");
    expect(codes).not.toContain("2027");
  });

  it("infers severity from document language", () => {
    expect(inferSeverity("Prohibition on imports of X")).toBe("CRITICAL");
    expect(inferSeverity("Modification of Section 301 tariffs")).toBe("WARN");
    expect(inferSeverity("Notice of public meeting")).toBe("INFO");
  });
});

describe("regulatory catalog alerts", () => {
  it("flags updates whose HS code prefixes a product the org classified", async () => {
    const ts = `${Date.now()}`;
    const ownerId = `u_owner_reg_${ts}`;
    const orgId = `org_reg_${ts}`;
    await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@x.local` } });
    await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
    await prisma.membership.create({ data: { userId: ownerId, orgId, role: "OWNER" } });

    const caller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    const sku = await caller.sku.create({ title: "Smartphone Model X", imageUrls: [], currency: "USD" });
    await caller.classification.run({ skuId: sku.id, destination: "US" });
    // Stub classifies this to an 8517.* code; the update affects heading 8517.
    await prisma.regulatoryUpdate.create({
      data: {
        source: "federal_register",
        externalId: `reg_${ts}`,
        title: "Section 301 tariff change on telephones",
        url: "https://example.gov/x",
        severity: "WARN",
        affectedHs: ["8517"],
        affectedDest: ["US"],
        publishedAt: new Date(),
      },
    });

    const alerts = await caller.regulatory.alertsForOrg();
    expect(alerts.alertCount).toBe(1);
    expect(alerts.affectedSkuCount).toBe(1);
    expect(alerts.alerts[0].products[0].skuId).toBe(sku.id);
    expect(alerts.alerts[0].products[0].hsCode.startsWith("8517")).toBe(true);
  });

  it("does not flag updates for unrelated HS codes", async () => {
    const ts = `${Date.now()}_2`;
    const ownerId = `u_owner_reg_${ts}`;
    const orgId = `org_reg_${ts}`;
    await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@x.local` } });
    await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
    await prisma.membership.create({ data: { userId: ownerId, orgId, role: "OWNER" } });
    const caller = appRouter.createCaller(createTestContext({ userId: ownerId, orgId, role: "OWNER" }));
    const sku = await caller.sku.create({ title: "Smartphone Model X", imageUrls: [], currency: "USD" });
    await caller.classification.run({ skuId: sku.id, destination: "US" });
    await prisma.regulatoryUpdate.create({
      data: {
        source: "federal_register",
        externalId: `reg_${ts}`,
        title: "Rule on cotton apparel",
        url: "https://example.gov/y",
        severity: "INFO",
        affectedHs: ["6109"],
        affectedDest: ["US"],
        publishedAt: new Date(),
      },
    });
    const alerts = await caller.regulatory.alertsForOrg();
    expect(alerts.alertCount).toBe(0);
  });
});
