import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

export default async function ClassificationsPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const { items } = await caller.classification.list({});

  async function estimateAndDraft(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const classificationId = String(formData.get("classificationId"));
    await caller.landedCost.estimate({ classificationId });
    await caller.declaration.create({ classificationId });
    revalidatePath("/declarations");
    revalidatePath("/classifications");
  }

  return (
    <>
      <h1>Classifications</h1>
      {items.length === 0 ? (
        <div className="empty">No classifications yet. Add a SKU and click Classify.</div>
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
                  <form action={estimateAndDraft} className="inline">
                    <input type="hidden" name="classificationId" value={c.id} />
                    <button type="submit" className="ghost">Draft declaration</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
