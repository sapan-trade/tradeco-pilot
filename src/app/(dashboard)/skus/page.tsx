import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getServerCaller } from "@/lib/server-caller";

export default async function SkusPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) {
    return <div className="note">Not authenticated.</div>;
  }
  const { items } = await caller.sku.list({});

  async function createSku(formData: FormData) {
    "use server";
    const { caller, ctx } = await getServerCaller();
    if (!ctx.org) throw new Error("Not authenticated");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const supplierCountry = String(formData.get("supplierCountry") ?? "").trim().toUpperCase();
    const unitValueRaw = String(formData.get("unitValueCents") ?? "").trim();
    await caller.sku.create({
      title,
      description: description || null,
      imageUrls: [],
      supplierCountry: supplierCountry.length === 2 ? supplierCountry : null,
      unitValueCents: unitValueRaw ? Number(unitValueRaw) : null,
      currency: "USD",
    });
    revalidatePath("/skus");
  }

  async function classifySku(formData: FormData) {
    "use server";
    const { caller, ctx } = await getServerCaller();
    if (!ctx.org) throw new Error("Not authenticated");
    const skuId = String(formData.get("skuId"));
    await caller.classification.run({ skuId, destination: "US" });
    revalidatePath("/skus");
    revalidatePath("/classifications");
  }

  return (
    <>
      <h1>SKUs</h1>

      <form action={createSku} className="stack" data-testid="create-sku">
        <label>Title<input name="title" required /></label>
        <label>Description<textarea name="description" /></label>
        <label>Supplier country (ISO-2)<input name="supplierCountry" maxLength={2} placeholder="VN" /></label>
        <label>Unit value (cents)<input name="unitValueCents" type="number" min={0} /></label>
        <button type="submit">Add SKU</button>
      </form>

      {items.length === 0 ? (
        <div className="empty">No SKUs yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Supplier</th>
              <th>Unit value</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/skus/${s.id}`}>{s.title}</Link></td>
                <td>{s.supplierCountry ?? "—"}</td>
                <td>{s.unitValueCents != null ? `$${(s.unitValueCents / 100).toFixed(2)}` : "—"}</td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                <td>
                  <form action={classifySku} className="inline">
                    <input type="hidden" name="skuId" value={s.id} />
                    <button name="classify" type="submit">Classify</button>
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
