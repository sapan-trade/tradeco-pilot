import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | TradeCo-Pilot",
  description: "Terms of Service for TradeCo-Pilot, including classification advisory disclaimers.",
};

// NOTE: Template only — must be reviewed by qualified legal counsel before relying on it.
export default function TermsPage() {
  return (
    <div className="container" style={{ maxWidth: 760, padding: "48px 24px", lineHeight: 1.7 }}>
      <p><Link href="/">← TradeCo-Pilot</Link></p>
      <h1>Terms of Service</h1>
      <p style={{ color: "var(--text-muted)" }}>Last updated: June 2026</p>

      <h2>1. Advisory nature of classifications</h2>
      <p>
        TradeCo-Pilot provides AI-generated HS/HTS tariff code suggestions, landed-cost estimates,
        and related information. <strong>These are advisory only and do not constitute legal,
        customs, tax, or professional advice.</strong> Tariff classification depends on facts
        (materials, construction, intended use, origin) that only you can fully determine.
      </p>

      <h2>2. Your responsibility as declarant</h2>
      <p>
        You are solely responsible for the accuracy and completeness of any information submitted to
        customs authorities. You remain the importer/declarant of record. You should independently
        verify any suggested classification — and, for low-confidence or high-value items, obtain
        sign-off from a <strong>licensed customs broker</strong> — before filing.
      </p>

      <h2>3. Broker review</h2>
      <p>
        Where a classification is reviewed by a licensed broker through the platform, that review
        reflects the broker&apos;s professional judgment. TradeCo-Pilot facilitates the connection
        and does not itself act as your customs broker or licensed representative.
      </p>

      <h2>4. No warranty</h2>
      <p>
        The service is provided &quot;as is&quot; without warranties of any kind, express or implied,
        including accuracy, fitness for a particular purpose, or non-infringement. We do not warrant
        that classifications are correct or that they will be accepted by any authority.
      </p>

      <h2>5. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, TradeCo-Pilot and its suppliers are not liable for
        any indirect, incidental, special, or consequential damages, or for duties, penalties, fines,
        seizures, delays, or losses arising from the use of, or reliance on, the service. Our
        aggregate liability is limited to the fees you paid in the 12 months preceding the claim.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        You agree not to misuse the service, attempt to circumvent rate limits or access controls, or
        use it to violate any applicable export, sanctions, or trade laws.
      </p>

      <h2>7. Changes</h2>
      <p>We may update these terms; continued use constitutes acceptance of the updated terms.</p>

      <p style={{ marginTop: 24 }}>
        Questions? Contact support. See also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
