import { readFileSync } from "node:fs";
import path from "node:path";

export interface HsEntry {
  hs: string;
  title: string;
  chapter: string;
  dutyRateBps: number;
  keywords: string[];
}

let cache: HsEntry[] | null = null;
let warned = false;

/**
 * Phase 1: loads from `prisma/seed/hts.json`. Phase 2 swaps for a USITC HTS feed loader
 * that populates a `HsCode` table and (later) embeddings for retrieval.
 */
export function loadHsCatalog(): HsEntry[] {
  if (cache) return cache;
  if (!warned) {
    console.log("[hts-stub] TODO: replace with real USITC HTS data feed loader.");
    warned = true;
  }
  const file = path.join(process.cwd(), "prisma", "seed", "hts.json");
  const raw = readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as { codes: HsEntry[] };
  cache = parsed.codes;
  return cache;
}

export function lookupDutyRateBps(hsCode: string): number {
  return loadHsCatalog().find((e) => e.hs === hsCode)?.dutyRateBps ?? 0;
}
