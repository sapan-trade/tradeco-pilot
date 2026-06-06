import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadHsCatalog } from "@/server/integrations/hts";

export function generateStaticParams() {
  return loadHsCatalog().map((c) => ({ code: c.hs }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const entry = loadHsCatalog().find((c) => c.hs === code);
  if (!entry) return { title: "HS code not found" };
  return {
    title: `HS Code ${entry.hs} — ${entry.title} | US duty ${(entry.dutyRateBps / 100).toFixed(2)}%`,
    description: `${entry.hs}: ${entry.title}. Chapter ${entry.chapter}, US import duty rate ${(entry.dutyRateBps / 100).toFixed(2)}%. Classify your product free with TradeCo-Pilot.`,
  };
}

export default async function HsCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const entry = loadHsCatalog().find((c) => c.hs === code);
  if (!entry) notFound();
  const related = loadHsCatalog().filter((c) => c.chapter === entry.chapter && c.hs !== entry.hs);

  return (
    <div className="container" style={{ maxWidth: 720, padding: "48px 24px" }}>
      <p>
        <Link href="/hs-code">← HS code directory</Link>
      </p>
      <span className="section-tag">HS / HTS code</span>
      <h1 style={{ fontSize: 34, fontFamily: "ui-monospace, monospace", marginBottom: 6 }}>{entry.hs}</h1>
      <p style={{ fontSize: 18, color: "var(--text-secondary)", marginBottom: 20 }}>{entry.title}</p>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card-label">US import duty</div>
          <div className="stat-card-value">{(entry.dutyRateBps / 100).toFixed(2)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Chapter</div>
          <div className="stat-card-value">{entry.chapter}</div>
        </div>
      </div>

      <p style={{ marginTop: 20, color: "var(--text-secondary)" }}>
        <strong>Common terms:</strong> {entry.keywords.join(", ")}.
      </p>

      <div className="feature-card" style={{ marginTop: 20, background: "var(--primary-50)", borderColor: "var(--primary-100)" }}>
        <strong>Is this the right code for your product?</strong>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "6px 0 12px" }}>
          Classification depends on materials, construction, and use. Get an AI suggestion in seconds,
          then have it <strong>verified by a licensed customs broker</strong>.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/lookup" className="btn-primary">Free AI lookup</Link>
          <Link href="/sign-up" className="btn-secondary">Create free account</Link>
        </div>
      </div>

      {related.length > 0 && (
        <>
          <h2 style={{ marginTop: 28, fontSize: 18 }}>Related codes in chapter {entry.chapter}</h2>
          <ul style={{ lineHeight: 1.9 }}>
            {related.map((c) => (
              <li key={c.hs}>
                <Link href={`/hs-code/${c.hs}`}><code>{c.hs}</code></Link> — {c.title}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
