import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { prisma } from "@/lib/db";
import { getObjectStore } from "@/server/integrations/s3";
import { runCsvImport } from "@/server/services/csv-importer";

export default async function ConnectorsPage() {
  const { ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;

  const connectors = await prisma.connector.findMany({ where: { orgId: ctx.org.id } });
  const jobs = await prisma.importJob.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  async function connectShopify(formData: FormData) {
    "use server";
    const shop = String(formData.get("shop") ?? "").trim().toLowerCase();
    if (!shop) return;
    redirect(`/api/connectors/shopify/start?shop=${encodeURIComponent(shop)}`);
  }

  async function uploadCsv(formData: FormData) {
    "use server";
    const { ctx } = await getServerCaller();
    if (!ctx.org || !ctx.user) throw new Error("Not authenticated");
    const csv = String(formData.get("csv") ?? "");
    if (!csv.trim()) return;
    const { fileToken } = await getObjectStore().presignUpload({ kind: "csv", orgId: ctx.org.id });
    await getObjectStore().putObject(fileToken, csv, "text/csv");
    const job = await prisma.importJob.create({
      data: { orgId: ctx.org.id, fileToken },
    });
    await runCsvImport({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      jobId: job.id,
      source: { fileToken },
    });
    revalidatePath("/connectors");
    revalidatePath("/skus");
  }

  return (
    <>
      <h1>Connectors</h1>

      <h2>Shopify</h2>
      <p style={{ color: "#6b7280" }}>
        OAuth-based connection. In dev (no <code>SHOPIFY_API_KEY</code>) the install URL points
        to a stub host; the callback handler still runs the full sync against synthetic products.
      </p>
      <form action={connectShopify} className="stack">
        <label>Shop domain<input name="shop" placeholder="store.myshopify.com" required /></label>
        <button type="submit">Connect Shopify</button>
      </form>

      <h3>Connected</h3>
      {connectors.length === 0 ? (
        <div className="empty">No connectors yet.</div>
      ) : (
        <table>
          <thead><tr><th>Type</th><th>Shop</th><th>Status</th><th>Last sync</th></tr></thead>
          <tbody>
            {connectors.map((c) => (
              <tr key={c.id}>
                <td>{c.type}</td>
                <td>{c.shopDomain ?? "—"}</td>
                <td><StatusPill status={c.status} /></td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>
                  {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 24 }}>CSV bulk upload</h2>
      <p style={{ color: "#6b7280" }}>
        Headers: <code>title, description, supplier_country, unit_value_cents, image_url</code>.
        Only <code>title</code> is required.
      </p>
      <form action={uploadCsv} className="stack">
        <label>Paste CSV<textarea name="csv" rows={6} placeholder="title,description,supplier_country,unit_value_cents&#10;Mug,Porcelain coffee mug,MX,800" /></label>
        <button type="submit">Import</button>
      </form>

      <h3>Recent imports</h3>
      {jobs.length === 0 ? (
        <div className="empty">No import jobs yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Job</th><th>Status</th><th>Rows</th><th>Inserted</th><th>Failed</th><th>Finished</th></tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td><code style={{ fontSize: 12 }}>{j.id.slice(0, 8)}</code></td>
                <td><StatusPill status={j.status} /></td>
                <td>{j.totalRows}</td>
                <td>{j.inserted}</td>
                <td>{j.failed}</td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>
                  {j.finishedAt ? new Date(j.finishedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
