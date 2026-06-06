import Link from "next/link";
import type { Metadata } from "next";
import { loadHsCatalog } from "@/server/integrations/hts";

export const metadata: Metadata = {
  title: "HS Code Directory — tariff codes & US import duty rates | TradeCo-Pilot",
  description:
    "Browse HS / HTS tariff codes with US import duty rates. Find the right classification for your product, or use the free AI lookup tool.",
};

export default function HsCodeIndex() {
  const codes = loadHsCatalog();
  return (
    <div className="container" style={{ maxWidth: 820, padding: "48px 24px" }}>
      <p><Link href="/">← TradeCo-Pilot</Link></p>
      <span className="section-tag">Directory</span>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>HS Code Directory</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 17, marginBottom: 24 }}>
        Common HS / HTS tariff codes and their US import duty rates. Not sure which applies?{" "}
        <Link href="/lookup">Use the free AI lookup →</Link>
      </p>

      <table>
        <thead>
          <tr><th>HS code</th><th>Description</th><th>Chapter</th><th>Duty</th></tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.hs}>
              <td><Link href={`/hs-code/${c.hs}`}><code>{c.hs}</code></Link></td>
              <td>{c.title}</td>
              <td>{c.chapter}</td>
              <td>{(c.dutyRateBps / 100).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
