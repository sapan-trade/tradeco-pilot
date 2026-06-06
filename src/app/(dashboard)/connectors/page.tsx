import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { prisma } from "@/lib/db";
import { getObjectStore } from "@/server/integrations/s3";
import { runCsvImport } from "@/server/services/csv-importer";
import { normalizeShopDomain } from "@/server/integrations/shopify";
import { SubmitButton } from "@/components/SubmitButton";

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; synced?: string }>;
}) {
  const { ctx } = await getServerCaller();
  if (!ctx.org || !ctx.user) return <div className="note">Not authenticated.</div>;

  const sp = await searchParams;
  const account = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { email: true },
  });
  const accountEmail = account?.email?.trim().toLowerCase() ?? null;

  const connectors = await prisma.connector.findMany({ where: { orgId: ctx.org.id } });
  const jobs = await prisma.importJob.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  async function connectShopify(formData: FormData) {
    "use server";
    const shop = normalizeShopDomain(String(formData.get("shop") ?? ""));
    if (!shop) redirect("/connectors?error=invalid_shop");
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
        Signed in as <strong>{accountEmail ?? "your account"}</strong>. Enter your store and approve
        the one-time Shopify prompt — we link it to your account automatically by matching the store
        owner&apos;s email.
      </p>

      {sp.error === "invalid_shop" && (
        <div className="note" style={{ background: "#fef2f2", color: "#b91c1c", padding: 12, borderRadius: 8 }}>
          That doesn&apos;t look like a Shopify store. Enter your store name (e.g. <code>mystore</code>)
          or its <code>.myshopify.com</code> address.
        </div>
      )}
      {sp.connected === "1" && (
        <div className="note" style={{ background: "#f0fdf4", color: "#15803d", padding: 12, borderRadius: 8 }}>
          Shopify connected — synced {sp.synced ?? 0} product{sp.synced === "1" ? "" : "s"}.
        </div>
      )}

      <form action={connectShopify} className="stack">
        <label>
          Shopify store
          <input name="shop" placeholder="mystore  (or mystore.myshopify.com)" required />
        </label>
        <SubmitButton pendingText="Connecting…">Connect Shopify</SubmitButton>
      </form>

      <h3>Connected</h3>
      {connectors.length === 0 ? (
        <div className="empty">No connectors yet.</div>
      ) : (
        <table>
          <thead><tr><th>Type</th><th>Shop</th><th>Store owner</th><th>Status</th><th>Last sync</th></tr></thead>
          <tbody>
            {connectors.map((c) => {
              const matches =
                !!c.shopEmail && !!accountEmail && c.shopEmail.toLowerCase() === accountEmail;
              return (
                <tr key={c.id}>
                  <td>{c.type}</td>
                  <td>{c.shopDomain ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {c.shopEmail ?? "—"}
                    {c.shopEmail &&
                      (matches ? (
                        <span style={{ color: "#15803d", marginLeft: 6 }} title="Matches your account">
                          ✓ matches your account
                        </span>
                      ) : (
                        <span style={{ color: "#b45309", marginLeft: 6 }} title="Different from your sign-in email">
                          ⚠ different email
                        </span>
                      ))}
                  </td>
                  <td><StatusPill status={c.status} /></td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>
                    {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
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
        <SubmitButton pendingText="Importing…">Import</SubmitButton>
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
