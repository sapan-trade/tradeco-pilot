import Link from "next/link";
import { getServerCaller } from "@/lib/server-caller";
import { DashboardStats } from "@/components/DashboardStats";

export default async function DashboardHome() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) {
    return (
      <div className="note">
        Not authenticated. Set <code>x-test-user</code> and <code>x-test-org</code> request
        headers, or sign in.
      </div>
    );
  }

  const [skus, classifications, declarations, billing, alerts] = await Promise.all([
    caller.sku.list({}),
    caller.classification.list({}),
    caller.declaration.list({}),
    caller.billing.subscription(),
    caller.regulatory.alertsForOrg(),
  ]);

  const needsReview = classifications.items.filter((c) => c.status === "NEEDS_REVIEW").length;
  const submitted = declarations.items.filter((d) => d.status === "SUBMITTED").length;

  return (
    <>
      <h1>Overview</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
        Org <code>{ctx.org.id.slice(0, 16)}…</code> · role <strong>{ctx.org.role}</strong> ·
        {" "}plan <strong>{billing.tier ?? "None"}</strong>
      </p>

      {alerts.alertCount > 0 && (
        <div className="banner banner-error" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span>
            ⚠ {alerts.alertCount} regulatory change(s) affect {alerts.affectedSkuCount} of your
            products.
          </span>
          <Link href="/regulatory" className="btn-secondary" style={{ padding: "6px 12px" }}>Review alerts</Link>
        </div>
      )}

      <DashboardStats
        stats={[
          { iconName: "Boxes", label: "SKUs", value: skus.items.length, sub: `${billing.skuAllowance < 0 ? "unlimited" : billing.skuAllowance} on ${billing.tier ?? "Free"}` },
          { iconName: "ScanLine", label: "Classifications", value: classifications.items.length, sub: classifications.items.length > 0 ? `${classifications.items[0].hsCode} most recent` : "none yet" },
          { iconName: "AlertTriangle", label: "Needs broker review", value: needsReview, sub: needsReview > 0 ? "queued for licensed broker" : "all auto-approved" },
          { iconName: "FileCheck", label: "Submitted declarations", value: submitted, sub: `${declarations.items.length} total` },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 32 }}>
        <Link href="/skus" className="stat-card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Add a SKU and classify</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Enter a title, supplier, image — get HS code, confidence, and landed cost in seconds.</div>
          </div>
          <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600, marginTop: 12 }}>Go to SKUs →</span>
        </Link>
        <Link href="/connectors" className="stat-card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Connect Shopify</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>One-click OAuth. Your entire catalog imported in one sync, with images flowing into vision-based classification.</div>
          </div>
          <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600, marginTop: 12 }}>Connect →</span>
        </Link>
        <Link href="/queue" className="stat-card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Broker review queue</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Items below your confidence threshold are routed to a licensed customs broker for sign-off.</div>
          </div>
          <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600, marginTop: 12 }}>Open queue →</span>
        </Link>
      </div>
    </>
  );
}
