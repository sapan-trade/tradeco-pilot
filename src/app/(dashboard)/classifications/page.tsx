import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { Banner } from "@/components/Banner";
import { Disclaimer } from "@/components/Disclaimer";

export default async function ClassificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; status?: string; error?: string }>;
}) {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const { items } = await caller.classification.list({});
  const sp = await searchParams;

  async function estimateAndDraft(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const classificationId = String(formData.get("classificationId"));
    try {
      await caller.landedCost.estimate({ classificationId });
      await caller.declaration.create({ classificationId });
    } catch {
      redirect("/classifications?error=draft");
    }
    revalidatePath("/declarations");
    revalidatePath("/classifications");
    // Take the user to the draft they just created — otherwise the click looks like a no-op.
    redirect("/declarations?ok=drafted");
  }

  const classifiedReview = sp.ok === "classified" && sp.status === "NEEDS_REVIEW";
  const classifiedAuto = sp.ok === "classified" && sp.status === "AUTO_APPROVED";
  const DRAFTABLE = new Set(["AUTO_APPROVED", "BROKER_APPROVED", "OVERRIDDEN"]);

  return (
    <>
      <h1>Classifications</h1>
      <Disclaimer />

      {classifiedAuto && (
        <Banner kind="success">
          Classified and auto-approved — confidence was high enough to skip review.
        </Banner>
      )}
      {classifiedReview && (
        <Banner kind="info">
          Classified, but confidence was low — it&apos;s been routed to a licensed broker for review.
        </Banner>
      )}
      {sp.ok === "classified" && !classifiedAuto && !classifiedReview && (
        <Banner kind="success">Classification complete.</Banner>
      )}
      {sp.error === "draft" && <Banner kind="error">Couldn&apos;t draft the declaration — please retry.</Banner>}

      {items.length === 0 ? (
        <div className="empty">
          No classifications yet. <Link href="/skus">Add a SKU and click Classify</Link> to get started.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>HS code</th>
              <th>Dest</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>FTA</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td><code>{c.hsCode}</code></td>
                <td>{c.destination}</td>
                <td><ConfidenceBadge value={c.confidence} /></td>
                <td data-testid={`status-${c.id}`}><StatusPill status={c.status} /></td>
                <td>{c.ftaProgram ?? "—"}</td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>{new Date(c.createdAt).toLocaleString()}</td>
                <td>
                  <Link href={`/skus/${c.skuId}`}>SKU</Link>{" · "}
                  {DRAFTABLE.has(c.status) ? (
                    <form action={estimateAndDraft} className="inline">
                      <input type="hidden" name="classificationId" value={c.id} />
                      <SubmitButton className="ghost" pendingText="Drafting…">Draft declaration</SubmitButton>
                    </form>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }} title="Only approved classifications can be filed">
                      {c.status === "NEEDS_REVIEW"
                        ? "awaiting broker review"
                        : c.status === "BROKER_REJECTED"
                        ? "rejected — can't file"
                        : "not ready"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
