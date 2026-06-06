export interface FederalRegisterEntry {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  affectedHs: string[];
  affectedDest: string[];
  severity: "INFO" | "WARN" | "CRITICAL";
}

export interface FederalRegisterFetcher {
  fetchSince(date: Date): Promise<{ entries: FederalRegisterEntry[] }>;
}

/**
 * Pull HS/HTS codes cited in a document's text. Conservative: only matches dotted
 * forms like "8517.62" or "6109.10.0010" so bare 4-digit years aren't false positives.
 */
export function extractHsCodes(text: string): string[] {
  const matches = text.match(/\b\d{4}\.\d{2}(?:\.\d{2,4})?\b/g) ?? [];
  return Array.from(new Set(matches));
}

/** Rough severity from the document language so the feed self-prioritizes. */
export function inferSeverity(text: string): "INFO" | "WARN" | "CRITICAL" {
  const t = text.toLowerCase();
  if (/(prohibit|embargo|\bbanned?\b|suspend|emergency|recall)/.test(t)) return "CRITICAL";
  if (/(antidumping|countervailing|section 301|tariff|dut(y|ies)|quota|increase|safeguard)/.test(t))
    return "WARN";
  return "INFO";
}

/**
 * Real implementation hits federalregister.gov public API.
 * No API key required. Tests inject their own FederalRegisterFetcher.
 */
export class HttpFederalRegisterFetcher implements FederalRegisterFetcher {
  async fetchSince(date: Date) {
    const start = date.toISOString().slice(0, 10);
    const url =
      `https://www.federalregister.gov/api/v1/documents.json` +
      `?conditions[publication_date][gte]=${start}` +
      `&conditions[topics][]=customs-duties-and-inspection` +
      `&fields[]=document_number&fields[]=title&fields[]=abstract&fields[]=html_url&fields[]=publication_date` +
      `&per_page=50&order=newest`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Federal Register API responded ${res.status}`);
    const json = (await res.json()) as { results?: Array<Record<string, any>> };
    const results = json.results ?? [];
    return {
      entries: results.map<FederalRegisterEntry>((r) => {
        const text = `${r.title ?? ""} ${r.abstract ?? ""}`;
        return {
          id: String(r.document_number ?? r.id),
          title: String(r.title ?? ""),
          url: String(r.html_url ?? ""),
          publishedAt: new Date(r.publication_date ?? Date.now()),
          affectedHs: extractHsCodes(text),
          affectedDest: ["US"],
          severity: inferSeverity(text),
        };
      }),
    };
  }
}

export function createFederalRegisterFetcher(): FederalRegisterFetcher {
  return new HttpFederalRegisterFetcher();
}
