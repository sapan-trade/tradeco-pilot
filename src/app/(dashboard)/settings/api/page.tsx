import { revalidatePath } from "next/cache";
import { getServerCaller } from "@/lib/server-caller";
import { SubmitButton } from "@/components/SubmitButton";
import { CreateApiKey } from "@/components/CreateApiKey";

type CreateState = { key?: string; prefix?: string; error?: string } | null;

export default async function ApiSettingsPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  if (ctx.org.role !== "OWNER") return <div className="note">Owner role required to manage API keys.</div>;

  const keys = await caller.apiKey.list();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  async function createKey(_prev: CreateState, formData: FormData): Promise<CreateState> {
    "use server";
    const { caller, ctx } = await getServerCaller();
    if (!ctx.org || ctx.org.role !== "OWNER") return { error: "Owner only" };
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Name is required" };
    try {
      const res = await caller.apiKey.create({ name });
      revalidatePath("/settings/api");
      return { key: res.key, prefix: res.prefix };
    } catch (e: any) {
      return { error: e?.message ?? "Failed to create key" };
    }
  }

  async function revoke(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    await caller.apiKey.revoke({ id: String(formData.get("id")) });
    revalidatePath("/settings/api");
  }

  return (
    <>
      <h1>API keys</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        Integrate Clearwise into your own systems — classify products programmatically.
      </p>

      <h2 style={{ marginTop: 16 }}>Create a key</h2>
      <CreateApiKey action={createKey} />

      <h2 style={{ marginTop: 24 }}>Your keys</h2>
      {keys.length === 0 ? (
        <div className="empty">No API keys yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Key</th><th>Last used</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td><code>{k.prefix}…</code></td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}
                </td>
                <td>{k.revokedAt ? "revoked" : "active"}</td>
                <td>
                  {!k.revokedAt && (
                    <form action={revoke} className="inline">
                      <input type="hidden" name="id" value={k.id} />
                      <SubmitButton className="danger" pendingText="…" confirm="Revoke this key? Apps using it will stop working.">Revoke</SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 24 }}>Quick start</h2>
      <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto" }}>
{`curl -X POST ${base}/api/v1/classify \\
  -H "Authorization: Bearer tcp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Men'\\''s cotton t-shirt","supplierCountry":"VN","destination":"US"}'

# -> { "skuId": "...", "hsCode": "6109.10.0010", "confidence": 0.93, "status": "AUTO_APPROVED" }`}
      </pre>
    </>
  );
}
