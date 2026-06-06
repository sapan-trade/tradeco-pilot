import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { generateHsCode } from "@/lib/ai";
import { lookupDutyRateBps } from "@/server/integrations/hts";
import { getRateLimiter } from "@/server/integrations/ratelimit";
import { track } from "@/server/services/telemetry";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Free HS Code Lookup — AI tariff classification | TradeCo-Pilot",
  description:
    "Find the HS / HTS tariff code for any product in seconds with AI. Free, no signup. See the code, confidence, and US import duty rate.",
};

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "anon").trim();
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let result: { hsCode: string; confidence: number; rationale: string; dutyPct: string } | null = null;
  let limited = false;

  if (query) {
    const rl = await getRateLimiter().consume(`publiclookup:${await clientIp()}`, 8, 60 * 60 * 1000);
    if (!rl.allowed) {
      limited = true;
    } else {
      const ai = await generateHsCode({
        skuId: `pub_${query.toLowerCase()}`,
        title: query,
        description: null,
        materials: null,
        supplierCountry: null,
      });
      result = {
        hsCode: ai.hsCode,
        confidence: ai.confidence,
        rationale: ai.rationale,
        dutyPct: `${(lookupDutyRateBps(ai.hsCode) / 100).toFixed(2)}%`,
      };
      await track("public_lookup", { props: { hsCode: ai.hsCode } });
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720, padding: "48px 24px" }}>
      <p><Link href="/">← TradeCo-Pilot</Link></p>
      <span className="section-tag">Free tool</span>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>HS Code Lookup</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 17, marginBottom: 24 }}>
        Describe a product and get its HS / HTS tariff code instantly. No signup.
      </p>

      <form method="get" action="/lookup" style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          name="q"
          defaultValue={query}
          placeholder="e.g. men's cotton t-shirt, leather wallet, bluetooth speaker"
          required
          style={{ flex: 1 }}
          aria-label="Product description"
        />
        <button type="submit" className="btn-primary">Classify</button>
      </form>

      {limited && (
        <div className="banner banner-error">
          You&apos;ve hit the free lookup limit for now.{" "}
          <Link href="/sign-up">Create a free account</Link> for unlimited classifications.
        </div>
      )}

      {result && (
        <div className="feature-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Suggested HS code for “{query}”</div>
          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "ui-monospace, monospace", margin: "6px 0" }}>
            {result.hsCode}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: "var(--text-secondary)" }}>
            <span>Confidence: <strong>{Math.round(result.confidence * 100)}%</strong></span>
            <span>Est. US duty: <strong>{result.dutyPct}</strong></span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 10, fontStyle: "italic" }}>
            {result.rationale}
          </p>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--border)", fontSize: 14 }}>
            This is an AI suggestion. For a <strong>broker-verified</strong> code, bulk classification,
            landed-cost estimates, and tariff-change alerts —{" "}
            <Link href="/sign-up"><strong>create a free account →</strong></Link>
          </div>
          <Disclaimer />
        </div>
      )}

      <div className="feature-card" style={{ background: "var(--primary-50)", borderColor: "var(--primary-100)" }}>
        <strong>Why TradeCo-Pilot?</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
          <li>AI codes reviewed by <strong>licensed customs brokers</strong></li>
          <li>Landed-cost estimates (duty, VAT, freight, fees)</li>
          <li><strong>Alerts when tariff rules change</strong> for your products</li>
          <li>Shopify / CSV bulk import · tamper-proof audit trail</li>
        </ul>
        <Link href="/sign-up" className="btn-primary" style={{ marginTop: 14 }}>Start free</Link>
      </div>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        Browse common codes in the <Link href="/hs-code">HS code directory →</Link>
      </p>
    </div>
  );
}
