import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";

export default async function BillingPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const sub = await caller.billing.subscription();

  async function checkout(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const tier = String(formData.get("tier")) as "STARTER" | "GROWTH" | "PRO";
    const { url } = await caller.billing.checkout({ tier });
    redirect(url);
  }

  async function portal() {
    "use server";
    const { caller } = await getServerCaller();
    const { url } = await caller.billing.portal();
    redirect(url);
  }

  return (
    <>
      <h1>Billing</h1>
      <p>Tier: <strong>{sub.tier ?? "None"}</strong> · Status: <StatusPill status={sub.status} /></p>
      <p>SKUs used: {sub.skuUsed} / {sub.skuAllowance < 0 ? "unlimited" : sub.skuAllowance}</p>
      {sub.currentPeriodEnd && (
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
        </p>
      )}

      {sub.tier === null ? (
        <>
          <h2>Choose a plan</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {(["STARTER", "GROWTH", "PRO"] as const).map((t) => (
              <form key={t} action={checkout} style={{ padding: 16, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, minWidth: 200 }}>
                <h3 style={{ margin: 0 }}>{t}</h3>
                <p style={{ fontSize: 13, color: "#6b7280" }}>
                  {t === "STARTER" ? "$299/mo · 500 SKUs" : t === "GROWTH" ? "$799/mo · 5,000 SKUs" : "$2,499/mo · Unlimited"}
                </p>
                <input type="hidden" name="tier" value={t} />
                <button type="submit">Subscribe</button>
              </form>
            ))}
          </div>
        </>
      ) : (
        <form action={portal}>
          <button type="submit">Manage in Stripe portal</button>
        </form>
      )}
    </>
  );
}
