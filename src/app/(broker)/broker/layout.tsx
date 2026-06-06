import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { SideNav, type NavItem } from "@/components/SideNav";
import { MobileNav } from "@/components/MobileNav";

/**
 * Broker-portal chrome. Platform-level (NOT org-scoped) — an independent broker may
 * have no organization at all, so this never forces org creation the way the tenant
 * dashboard does. Nav adapts to whether the user has applied / been approved.
 */
export default async function BrokerPortalLayout({ children }: { children: React.ReactNode }) {
  const { caller, ctx } = await getServerCaller();

  if (!ctx.user) {
    return (
      <div className="note" style={{ margin: 48 }}>
        Not signed in. <Link href="/sign-in">Sign in</Link> or{" "}
        <Link href="/sign-up">create an account</Link> to join as a broker.
      </div>
    );
  }

  const [me, unread] = await Promise.all([
    caller.brokerPortal.me(),
    caller.notification.unreadCount(),
  ]);

  const brokerItems: NavItem[] = [
    ...(!me ? [{ href: "/broker/apply", label: "Apply", icon: "ClipboardList" as const }] : []),
    ...(me ? [{ href: "/broker/dashboard", label: "Dashboard", icon: "LayoutDashboard" as const }] : []),
    ...(me?.status === "APPROVED"
      ? [{ href: "/broker/marketplace", label: "Marketplace", icon: "Store" as const }]
      : []),
    { href: "/notifications", label: "Notifications", icon: "Bell", badge: unread },
  ];

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="mark">TC</span>
          <span>Broker portal</span>
        </div>
        <SideNav items={brokerItems} />
        <Link href="/dashboard" className="navlink" style={{ marginTop: 4 }}>← Tenant app</Link>

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          {me && (
            <div style={{ marginBottom: 8 }}>
              <StatusPill status={me.status} />
            </div>
          )}
          <UserButton />
        </div>
      </nav>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="mobile-topbar">
          <MobileNav
            items={[
              ...(!me ? [{ href: "/broker/apply", label: "Apply" }] : []),
              ...(me ? [{ href: "/broker/dashboard", label: "Dashboard" }] : []),
              ...(me?.status === "APPROVED" ? [{ href: "/broker/marketplace", label: "Marketplace" }] : []),
              { href: "/notifications", label: unread > 0 ? `🔔 ${unread}` : "🔔" },
              { href: "/dashboard", label: "Tenant app" },
            ]}
          />
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
