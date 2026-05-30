import { describe, it, expect } from "vitest";
import { ingestRegulatoryUpdates } from "@/inngest/functions/ingest-regulatory";
import type {
  FederalRegisterFetcher,
  FederalRegisterEntry,
} from "@/server/integrations/federal-register";
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
