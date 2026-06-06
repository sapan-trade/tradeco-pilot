import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";

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

  const me = await caller.brokerPortal.me();

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>Broker portal</h2>
        {!me && <Link href="/broker/apply">Apply</Link>}
        {me && <Link href="/broker/dashboard">Dashboard</Link>}
        {me?.status === "APPROVED" && <Link href="/broker/marketplace">Marketplace</Link>}
        <Link href="/dashboard">← Tenant app</Link>

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          {me && (
            <div style={{ marginBottom: 8 }}>
              <StatusPill status={me.status} />
            </div>
          )}
          <UserButton />
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
