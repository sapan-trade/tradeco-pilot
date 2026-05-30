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
      `&per_page=50&order=newest`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Federal Register API responded ${res.status}`);
    const json = (await res.json()) as { results?: Array<Record<string, any>> };
    const results = json.results ?? [];
    return {
      entries: results.map<FederalRegisterEntry>((r) => ({
        id: String(r.document_number ?? r.id),
        title: String(r.title ?? ""),
        url: String(r.html_url ?? ""),
        publishedAt: new Date(r.publication_date ?? Date.now()),
        affectedHs: [],
        affectedDest: ["US"],
        severity: "INFO",
      })),
    };
  }
}

export function createFederalRegisterFetcher(): FederalRegisterFetcher {
  return new HttpFederalRegisterFetcher();
}
