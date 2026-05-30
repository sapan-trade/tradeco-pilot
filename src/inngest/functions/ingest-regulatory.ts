import { inngest } from "../client";
import { prisma } from "@/lib/db";
import {
  createFederalRegisterFetcher,
  type FederalRegisterFetcher,
} from "@/server/integrations/federal-register";

const SOURCE = "federal_register";
const LOOKBACK_DAYS = 7;

export async function ingestRegulatoryUpdates(
  fetcher: FederalRegisterFetcher = createFederalRegisterFetcher()
): Promise<{ inserted: number; updated: number }> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const { entries } = await fetcher.fetchSince(since);
  let inserted = 0;
  let updated = 0;
  for (const e of entries) {
    const existing = await prisma.regulatoryUpdate.findUnique({
      where: { source_externalId: { source: SOURCE, externalId: e.id } },
    });
    if (existing) {
      await prisma.regulatoryUpdate.update({
        where: { id: existing.id },
        data: { title: e.title, url: e.url, severity: e.severity },
      });
      updated++;
    } else {
      await prisma.regulatoryUpdate.create({
        data: {
          source: SOURCE,
          externalId: e.id,
          title: e.title,
          url: e.url,
          severity: e.severity,
          affectedHs: e.affectedHs,
          affectedDest: e.affectedDest,
          publishedAt: e.publishedAt,
        },
      });
      inserted++;
    }
  }
  return { inserted, updated };
}

export const ingestRegulatoryFn = inngest.createFunction(
  { id: "ingest-regulatory" },
  { cron: "0 6 * * *" },
  async () => ingestRegulatoryUpdates()
);
