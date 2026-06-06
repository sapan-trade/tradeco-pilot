import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { StatusPill } from "@/components/StatusPill";
import { SubmitButton } from "@/components/SubmitButton";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function MarketplaceCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { caller, ctx } = await getServerCaller();
  if (!ctx.user) return <div className="note">Not authenticated.</div>;

  let review;
  try {
    review = await caller.marketplace.get({ reviewId: id });
  } catch {
    notFound();
  }

  async function claim() {
    "use server";
    const { caller } = await getServerCaller();
    try {
      await caller.marketplace.claim({ reviewId: id });
    } catch {
      redirect("/broker/marketplace?error=claim");
    }
    redirect(`/broker/marketplace/${id}`);
  }

  async function decide(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const decision = String(formData.get("decision")) as "APPROVED" | "CORRECTED" | "REJECTED";
    const correctedHsCode = String(formData.get("correctedHsCode") ?? "").trim() || undefined;
    const notes = String(formData.get("notes") ?? "").trim() || undefined;
    await caller.marketplace.decide({ reviewId: id, decision, correctedHsCode, notes });
    redirect("/broker/marketplace");
  }

  const decided = review.decision !== null;

  return (
    <>
      <h1>Case · {usd(review.feeCents)} fee</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Merchant: {review.orgName}</p>

      <p>
        <strong>{review.sku.title}</strong>
        <br />
        <span style={{ color: "var(--text-secondary)" }}>
          {review.sku.description ?? <em>No description</em>}
        </span>
      </p>
      <p>
        Predicted: <code>{review.predictedHsCode}</code> · <ConfidenceBadge value={review.confidence} /> ·
        Destination <strong>{review.destination}</strong>
      </p>
      <p style={{ fontSize: 13, color: "#374151" }}><em>{review.rationale}</em></p>

      {decided && (
        <div className="note">
          Already decided: <StatusPill status={`BROKER_${review.decision === "REJECTED" ? "REJECTED" : "APPROVED"}`} />
        </div>
      )}
      {review.claimedByOther && !decided && (
        <div className="note">Another broker has claimed this case.</div>
      )}

      {!decided && !review.claimedByOther && (
        <>
          {!review.claimedByMe && (
            <form action={claim} className="inline" style={{ marginBottom: 12 }}>
              <SubmitButton pendingText="Claiming…">Claim this case</SubmitButton>
              <span style={{ marginLeft: 10, fontSize: 13, color: "var(--text-muted)" }}>
                Reserve it so no one else picks it up.
              </span>
            </form>
          )}

          <form action={decide} className="stack">
            <label>Notes<textarea name="notes" placeholder="Reasoning for your decision" /></label>
            <label>
              Corrected HS code (only if decision = Correct)
              <input name="correctedHsCode" placeholder="6109.10.0099" />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <SubmitButton name="decision" value="APPROVED" pendingText="Saving…">Approve</SubmitButton>
              <SubmitButton name="decision" value="CORRECTED" className="ghost" pendingText="Saving…">Correct</SubmitButton>
              <SubmitButton name="decision" value="REJECTED" className="danger" pendingText="Saving…">Reject</SubmitButton>
            </div>
          </form>
        </>
      )}

      <p style={{ marginTop: 16 }}>
        <Link href="/broker/marketplace">← Back to marketplace</Link>
      </p>
    </>
  );
}
