import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function BrokerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string; payout?: string; error?: string }>;
}) {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.user) return <div className="note">Not authenticated.</div>;

  const me = await caller.brokerPortal.me();
  if (!me) redirect("/broker/apply");
  const sp = await searchParams;

  async function startOnboarding() {
    "use server";
    const { caller } = await getServerCaller();
    const { url } = await caller.brokerPortal.onboardingLink();
    redirect(url);
  }

  async function payout() {
    "use server";
    const { caller } = await getServerCaller();
    try {
      await caller.brokerPortal.requestPayout();
    } catch {
      redirect("/broker/dashboard?error=payout");
    }
    redirect("/broker/dashboard?payout=ok");
  }

  return (
    <>
      <h1>Broker dashboard</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 20px" }}>
        <StatusPill status={me.status} />
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          License {me.licenseNumber} · {me.licenseCountry}
        </span>
      </div>

      {me.status === "PENDING" && (
        <div className="note">
          Your application is under review. You can complete Stripe payout setup now so you&apos;re
          ready to earn the moment you&apos;re approved.
        </div>
      )}
      {me.status === "REJECTED" && (
        <div className="note">
          Application not approved{me.rejectionReason ? `: ${me.rejectionReason}` : "."}
        </div>
      )}
      {me.status === "SUSPENDED" && <div className="note">Your broker account is suspended.</div>}
      {sp.payout === "ok" && (
        <div className="note" style={{ background: "var(--success-light)", borderColor: "#a7f3d0", color: "#065f46" }}>
          Payout sent — funds are on their way to your bank via Stripe.
        </div>
      )}
      {sp.error === "payout" && (
        <div className="note" style={{ background: "var(--danger-light)", borderColor: "#fecaca", color: "#991b1b" }}>
          Payout failed — finish Stripe onboarding, or there may be nothing to pay out yet.
        </div>
      )}

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card-label">Pending earnings</div>
          <div className="stat-card-value">{usd(me.earnings.pendingCents)}</div>
          <div className="stat-card-sub">{me.earnings.pendingCount} review(s) awaiting payout</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Paid out</div>
          <div className="stat-card-value">{usd(me.earnings.paidCents)}</div>
          <div className="stat-card-sub">{me.earnings.paidCount} review(s) paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Payout status</div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>
            {me.payoutsEnabled ? "Ready" : me.stripeConnected ? "In progress" : "Not set up"}
          </div>
          <div className="stat-card-sub">Stripe Connect</div>
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Payouts</h2>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        <form action={startOnboarding} className="inline">
          <button type="submit" className={me.payoutsEnabled ? "ghost" : ""}>
            {me.stripeConnected ? "Manage Stripe payouts" : "Set up Stripe payouts"}
          </button>
        </form>
        <form action={payout} className="inline">
          <button type="submit" disabled={!me.payoutsEnabled || me.earnings.pendingCents === 0}>
            Request payout ({usd(me.earnings.pendingCents)})
          </button>
        </form>
      </div>

      {me.status === "APPROVED" && (
        <p style={{ marginTop: 20 }}>
          You&apos;re approved — <Link href="/broker/marketplace">open the marketplace</Link> to claim
          and review cases.
        </p>
      )}
    </>
  );
}
