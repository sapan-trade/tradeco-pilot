import Link from "next/link";
import { CreateOrganization, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { getServerCaller } from "@/lib/server-caller";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await getServerCaller();

  if (!ctx.user) {
    return (
      <div className="note" style={{ margin: 48 }}>
        Not signed in. <Link href="/sign-in">Sign in</Link> or <Link href="/sign-up">create an account</Link>.
      </div>
    );
  }

  if (!ctx.org) {
    return (
      <div style={{ padding: 48, maxWidth: 640, margin: "0 auto" }}>
        <h1>Create your organization</h1>
        <p style={{ color: "#6b7280" }}>
          TradeCo-Pilot is multi-tenant — every SKU, classification, and declaration is scoped to an org.
          Create one to get started.
        </p>
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>Tenant</h2>
        <Link href="/dashboard">Overview</Link>
        <Link href="/skus">SKUs</Link>
        <Link href="/classifications">Classifications</Link>
        <Link href="/declarations">Declarations</Link>
        <Link href="/connectors">Connectors</Link>
        <Link href="/regulatory">Regulatory</Link>
        <Link href="/audit">Audit log</Link>
        <Link href="/settings/billing">Billing</Link>
        <h2 style={{ marginTop: 20 }}>Broker</h2>
        <Link href="/queue">Queue</Link>
        <div style={{ marginTop: 24, padding: 8, background: "#1f2937", borderRadius: 4 }}>
          <div style={{ marginBottom: 8 }}><OrganizationSwitcher hidePersonal /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserButton />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{ctx.org.role}</span>
          </div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
