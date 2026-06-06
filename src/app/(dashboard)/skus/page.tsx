import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { SubmitButton } from "@/components/SubmitButton";
import { CountrySelect } from "@/components/CountrySelect";
import { Banner } from "@/components/Banner";

export default async function SkusPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}) {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) {
    return <div className="note">Not authenticated.</div>;
  }
  const { items } = await caller.sku.list({});
  const sp = await searchParams;

  async function createSku(formData: FormData) {
    "use server";
    const { caller, ctx } = await getServerCaller();
    if (!ctx.org) throw new Error("Not authenticated");
    const title = String(formData.get("title") ?? "").trim();
    if (!title) redirect("/skus?error=title");
    const description = String(formData.get("description") ?? "").trim();
    const supplierCountry = String(formData.get("supplierCountry") ?? "").trim().toUpperCase();
    // Form collects dollars (what people think in); convert to the cents the API stores.
    const dollarsRaw = String(formData.get("unitValueDollars") ?? "").trim();
    const unitValueCents = dollarsRaw ? Math.round(Number(dollarsRaw) * 100) : null;
    try {
      await caller.sku.create({
        title,
        description: description || null,
        imageUrls: [],
        supplierCountry: supplierCountry.length === 2 ? supplierCountry : null,
        unitValueCents: unitValueCents != null && !Number.isNaN(unitValueCents) ? unitValueCents : null,
        currency: "USD",
      });
    } catch {
      redirect("/skus?error=create");
    }
    revalidatePath("/skus");
    redirect("/skus?ok=created");
  }

  async function classifySku(formData: FormData) {
    "use server";
    const { caller, ctx } = await getServerCaller();
    if (!ctx.org) throw new Error("Not authenticated");
    const skuId = String(formData.get("skuId"));
    let status = "";
    try {
      const res = await caller.classification.run({ skuId, destination: "US" });
      status = res.status;
    } catch {
      redirect("/skus?error=classify");
    }
    revalidatePath("/skus");
    revalidatePath("/classifications");
    // Send them to the result so the click visibly produces something.
    redirect(`/classifications?ok=classified&status=${status}`);
  }

  return (
    <>
      <h1>SKUs</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
        Add a product, then <strong>Classify</strong> it to get its HS tariff code, confidence, and
        landed cost.
      </p>

      {sp.ok === "created" && <Banner kind="success">Product added. Click <strong>Classify</strong> on its row to get a tariff code.</Banner>}
      {sp.error === "title" && <Banner kind="error">A title is required.</Banner>}
      {sp.error === "create" && <Banner kind="error">Couldn&apos;t add that product. Please try again.</Banner>}
      {sp.error === "classify" && <Banner kind="error">Classification failed — please retry in a moment.</Banner>}

      <form action={createSku} className="stack" data-testid="create-sku">
        <label>
          Title
          <input name="title" required placeholder="Men's cotton T-shirt" />
        </label>
        <label>
          Description
          <textarea name="description" placeholder="Materials, use, and any detail that helps identify the product" />
          <span className="field-help">More detail = higher-confidence classification.</span>
        </label>
        <label>
          Country of origin
          <CountrySelect name="supplierCountry" placeholder="Where it's made / ships from" />
        </label>
        <label>
          Unit value
          <span className="input-prefix">
            <span>$</span>
            <input name="unitValueDollars" type="number" min={0} step="0.01" placeholder="8.99" />
          </span>
          <span className="field-help">Price per unit in USD — used to estimate duties &amp; landed cost.</span>
        </label>
        <SubmitButton pendingText="Adding…">Add SKU</SubmitButton>
      </form>

      {items.length === 0 ? (
        <div className="empty">
          No products yet — add your first one above, or{" "}
          <Link href="/connectors">import from Shopify or CSV</Link>.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Origin</th>
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
                    <SubmitButton name="classify" pendingText="Classifying…">Classify</SubmitButton>
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
