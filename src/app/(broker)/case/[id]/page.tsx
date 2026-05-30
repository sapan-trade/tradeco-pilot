import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { StatusPill } from "@/components/StatusPill";

export default async function BrokerCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  if (ctx.org.role !== "BROKER" && ctx.org.role !== "ADMIN") {
    return <div className="note">Broker role required.</div>;
  }

  let review;
  try {
    review = await caller.broker.get({ reviewId: id });
  } catch {
    notFound();
  }

  async function decide(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const decision = String(formData.get("decision")) as "APPROVED" | "CORRECTED" | "REJECTED";
    const correctedHsCode = String(formData.get("correctedHsCode") ?? "").trim() || undefined;
    const notes = String(formData.get("notes") ?? "").trim() || undefined;
    await caller.broker.decide({ reviewId: id, decision, correctedHsCode, notes });
    redirect("/queue");
  }

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>Broker</h2>
        <Link href="/queue">Queue</Link>
      </nav>
      <main className="main">
        <h1>Case</h1>
        <p>
          <strong>{review.sku.title}</strong><br />
          <span style={{ color: "#6b7280" }}>{review.sku.description ?? <em>No description</em>}</span>
        </p>
        <p>
          Predicted: <code>{review.predictedHsCode}</code> ·
          <ConfidenceBadge value={review.confidence} /> ·
          Destination <strong>{review.destination}</strong>
        </p>
        <p style={{ fontSize: 13, color: "#374151" }}><em>{review.rationale}</em></p>
        {review.decision && (
          <p>Already decided: <StatusPill status={review.decision} /></p>
        )}

        <form action={decide} className="stack">
          <label>Notes<textarea name="notes" /></label>
          <label>Corrected HS code (only if decision = CORRECTED)
            <input name="correctedHsCode" placeholder="6109.10.0099" />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button name="decision" value="APPROVED" type="submit">Approve</button>
            <button name="decision" value="CORRECTED" type="submit" className="ghost">Correct</button>
            <button name="decision" value="REJECTED" type="submit" className="danger">Reject</button>
          </div>
        </form>
      </main>
    </div>
  );
}
