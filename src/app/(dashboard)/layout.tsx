import Link from "next/link";
import { CreateOrganization, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { getServerCaller } from "@/lib/server-caller";
import { SideNav } from "@/components/SideNav";
import { MobileNav } from "@/components/MobileNav";
import { BrandMark } from "@/components/BrandMark";
import { BRAND } from "@/lib/brand";

// Server actions on the dashboard (Classify, Submit, etc.) call Claude which
// can take 5-15s. Hobby plan default is 10s; bump per-route to 60s.
export const maxDuration = 60;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { caller, ctx } = await getServerCaller();

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

  const unread = await caller.notification.unreadCount();

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <BrandMark size={28} />
          <span>{BRAND.name}</span>
        </div>
        <h2>Tenant</h2>
        <SideNav
          items={[
            { href: "/dashboard", label: "Overview", icon: "LayoutDashboard" },
            { href: "/notifications", label: "Notifications", icon: "Bell", badge: unread },
            { href: "/analytics", label: "Analytics", icon: "BarChart3" },
            { href: "/skus", label: "SKUs", icon: "Boxes" },
            { href: "/classifications", label: "Classifications", icon: "ScanLine" },
            { href: "/declarations", label: "Declarations", icon: "FileText" },
            { href: "/connectors", label: "Connectors", icon: "Plug" },
            { href: "/regulatory", label: "Regulatory", icon: "Scale" },
            { href: "/audit", label: "Audit log", icon: "ClipboardList" },
            { href: "/settings/billing", label: "Billing", icon: "CreditCard" },
            { href: "/settings/api", label: "API keys", icon: "KeyRound" },
          ]}
        />
        <h2 style={{ marginTop: 20 }}>Broker</h2>
        <SideNav
          items={[
            { href: "/queue", label: "Queue", icon: "Inbox" },
            { href: "/broker/dashboard", label: "Marketplace portal", icon: "Store" },
          ]}
        />
        {ctx.org.role === "ADMIN" && (
          <>
            <h2 style={{ marginTop: 20 }}>Admin</h2>
            <SideNav items={[{ href: "/admin/brokers", label: "Broker applications", icon: "ShieldCheck" }]} />
          </>
        )}
        <div style={{ marginTop: "auto", padding: 8, background: "#1f2937", borderRadius: 4 }}>
          <div style={{ marginBottom: 8 }}><OrganizationSwitcher hidePersonal /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserButton />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{ctx.org.role}</span>
          </div>
        </div>
      </nav>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="mobile-topbar">
          <MobileNav
            items={[
              { href: "/dashboard", label: "Overview" },
              { href: "/notifications", label: unread > 0 ? `🔔 ${unread}` : "🔔" },
              { href: "/analytics", label: "Analytics" },
              { href: "/skus", label: "SKUs" },
              { href: "/classifications", label: "Classifications" },
              { href: "/declarations", label: "Declarations" },
              { href: "/connectors", label: "Connectors" },
              { href: "/regulatory", label: "Regulatory" },
              { href: "/audit", label: "Audit" },
              { href: "/settings/billing", label: "Billing" },
              { href: "/broker/dashboard", label: "Broker" },
              ...(ctx.org.role === "ADMIN" ? [{ href: "/admin/brokers", label: "Admin" }] : []),
            ]}
          />
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
