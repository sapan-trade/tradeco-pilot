import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { SubmitButton } from "@/components/SubmitButton";
import { Disclaimer } from "@/components/Disclaimer";

const usd = (cents?: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(2)}`);
const pct = (bps?: number | null) => (bps == null ? "—" : `${(bps / 100).toFixed(2)}%`);

interface PackageJson {
  hsCode?: string;
  confidence?: number;
  destination?: string;
  skuTitle?: string;
  supplierCountry?: string | null;
  unitValueCents?: number | null;
  landedCost?: {
    dutyRateBps?: number;
    vatRateBps?: number;
    freightCents?: number;
    feesCents?: number;
    totalLandedCents?: number;
  } | null;
  snapshotAt?: string;
}

export default async function DeclarationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;

  let d;
  try {
    d = await caller.declaration.get({ id });
  } catch {
    notFound();
  }
  const pkg = (d.packageJson ?? {}) as PackageJson;
  const lc = pkg.landedCost ?? null;

  async function submit() {
    "use server";
    const { caller } = await getServerCaller();
    try {
      await caller.declaration.submit({ id });
    } catch {
      redirect(`/declarations/${id}?error=submit`);
    }
    revalidatePath(`/declarations/${id}`);
    revalidatePath("/declarations");
    redirect("/declarations?ok=submitted");
  }

  return (
    <>
      <p style={{ marginBottom: 4 }}><Link href="/declarations">← Declarations</Link></p>
      <h1>Declaration</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 16px" }}>
        <StatusPill status={d.status} />
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {pkg.skuTitle ?? "—"} · HS <code>{pkg.hsCode ?? d.classificationId}</code> · to{" "}
          <strong>{d.destination}</strong>
        </span>
      </div>

      <h2>Landed-cost breakdown</h2>
      {lc ? (
        <table style={{ maxWidth: 520, margin: "12px 0" }}>
          <tbody>
            <tr><td>Unit value</td><td style={{ textAlign: "right" }}>{usd(pkg.unitValueCents)}</td></tr>
            <tr><td>Duty rate</td><td style={{ textAlign: "right" }}>{pct(lc.dutyRateBps)}</td></tr>
            <tr><td>VAT / tax rate</td><td style={{ textAlign: "right" }}>{pct(lc.vatRateBps)}</td></tr>
            <tr><td>Freight</td><td style={{ textAlign: "right" }}>{usd(lc.freightCents)}</td></tr>
            <tr><td>Fees</td><td style={{ textAlign: "right" }}>{usd(lc.feesCents)}</td></tr>
            <tr style={{ fontWeight: 700 }}>
              <td>Total landed cost</td>
              <td style={{ textAlign: "right" }}>{usd(lc.totalLandedCents)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="empty" style={{ maxWidth: 520 }}>No landed-cost estimate was attached to this declaration.</div>
      )}

      <h2 style={{ marginTop: 20 }}>Details</h2>
      <table style={{ maxWidth: 520, margin: "12px 0" }}>
        <tbody>
          <tr><td>Origin</td><td style={{ textAlign: "right" }}>{pkg.supplierCountry ?? "—"}</td></tr>
          <tr><td>Classification confidence</td><td style={{ textAlign: "right" }}>{pkg.confidence != null ? `${Math.round(pkg.confidence * 100)}%` : "—"}</td></tr>
          <tr><td>Reference</td><td style={{ textAlign: "right" }}>{d.shipmentRef ?? d.id.slice(0, 8)}</td></tr>
          <tr><td>Submitted</td><td style={{ textAlign: "right" }}>{d.submittedAt ? new Date(d.submittedAt).toLocaleString() : "—"}</td></tr>
          <tr><td>Snapshot taken</td><td style={{ textAlign: "right", fontSize: 12, color: "var(--text-muted)" }}>{pkg.snapshotAt ? new Date(pkg.snapshotAt).toLocaleString() : "—"}</td></tr>
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        {d.status === "DRAFT" && (
          <form action={submit} className="inline">
            <SubmitButton pendingText="Submitting…" confirm="Submit this declaration? This files it and uses one credit.">
              Submit declaration
            </SubmitButton>
          </form>
        )}
        <Link href={`/declarations/${id}/invoice`} className="btn-secondary" style={{ padding: "8px 14px" }}>
          View / print invoice
        </Link>
      </div>
      <Disclaimer variant="filing" />
    </>
  );
}
