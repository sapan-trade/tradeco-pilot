import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

export default async function SkuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;

  let sku;
  try {
    sku = await caller.sku.get({ id });
  } catch {
    notFound();
  }

  async function classifyAgain(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const destination = String(formData.get("destination") ?? "US");
    await caller.classification.run({ skuId: id, destination });
    revalidatePath(`/skus/${id}`);
  }

  return (
    <>
      <h1>{sku.title}</h1>
      <p style={{ color: "#6b7280" }}>{sku.description ?? <em>No description</em>}</p>
      <p>
        Supplier: <strong>{sku.supplierCountry ?? "—"}</strong> ·
        Unit value: <strong>{sku.unitValueCents != null ? `$${(sku.unitValueCents / 100).toFixed(2)}` : "—"}</strong>
      </p>

      <form action={classifyAgain} className="stack">
        <label>Destination (ISO-2)<input name="destination" defaultValue="US" maxLength={2} required /></label>
        <button type="submit">Run classification</button>
      </form>

      <h2>Classifications</h2>
      {sku.classifications.length === 0 ? (
        <div className="empty">None yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>HS code</th><th>Dest</th><th>Confidence</th><th>Status</th><th>Created</th></tr>
          </thead>
          <tbody>
            {sku.classifications.map((c) => (
              <tr key={c.id}>
                <td><code>{c.hsCode}</code></td>
                <td>{c.destination}</td>
                <td><ConfidenceBadge value={c.confidence} /></td>
                <td><StatusPill status={c.status} /></td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>{new Date(c.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
