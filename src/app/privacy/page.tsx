import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | TradeCo-Pilot",
  description: "How TradeCo-Pilot collects, uses, and protects your data.",
};

// NOTE: Template only — must be reviewed by qualified legal counsel before relying on it.
export default function PrivacyPage() {
  return (
    <div className="container" style={{ maxWidth: 760, padding: "48px 24px", lineHeight: 1.7 }}>
      <p><Link href="/">← TradeCo-Pilot</Link></p>
      <h1>Privacy Policy</h1>
      <p style={{ color: "var(--text-muted)" }}>Last updated: June 2026</p>

      <h2>Data we collect</h2>
      <p>
        Account data (via our identity provider), the product and shipment data you enter or import,
        and usage data. We do not sell your data.
      </p>

      <h2>How we use it</h2>
      <p>
        To classify products, estimate landed cost, surface regulatory alerts, process payments, and
        improve the service. Product descriptions may be sent to our AI provider to generate
        classifications.
      </p>

      <h2>Subprocessors</h2>
      <p>
        We rely on third parties for hosting, database, authentication, payments, AI classification,
        error monitoring, and email. Each processes data only to provide their service.
      </p>

      <h2>Retention &amp; deletion</h2>
      <p>
        We retain data for as long as your account is active. You may request export or deletion of
        your data, subject to legal record-keeping obligations.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Access is restricted and audit-logged. No method of
        transmission or storage is 100% secure.
      </p>

      <p style={{ marginTop: 24 }}>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </div>
  );
}
