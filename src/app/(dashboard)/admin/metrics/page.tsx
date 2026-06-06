import { getServerCaller } from "@/lib/server-caller";

export default async function MetricsPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;

  let m;
  try {
    m = await caller.metrics.overview();
  } catch {
    return (
      <div className="note">
        Platform admin only. Add your account email to the <code>PLATFORM_ADMIN_EMAILS</code> env var
        (comma-separated) to view business metrics.
      </div>
    );
  }

  const maxEvent = Math.max(1, ...m.events.map((e) => e.count));

  return (
    <>
      <h1>Business metrics</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
        Platform-wide. Funnel events cover the last 30 days.
      </p>

      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-label">Organizations</div><div className="stat-card-value">{m.orgs}</div><div className="stat-card-sub">{m.users} users</div></div>
        <div className="stat-card"><div className="stat-card-label">Activated</div><div className="stat-card-value">{m.activationRate}%</div><div className="stat-card-sub">{m.activeOrgs} orgs classified ≥1 product</div></div>
        <div className="stat-card"><div className="stat-card-label">Paying</div><div className="stat-card-value">{m.payingOrgs}</div><div className="stat-card-sub">{m.conversionRate}% of orgs</div></div>
        <div className="stat-card"><div className="stat-card-label">Approved brokers</div><div className="stat-card-value">{m.approvedBrokers}</div></div>
        <div className="stat-card"><div className="stat-card-label">Classifications</div><div className="stat-card-value">{m.classifications}</div><div className="stat-card-sub">all time</div></div>
        <div className="stat-card"><div className="stat-card-label">Declarations submitted</div><div className="stat-card-value">{m.declarationsSubmitted}</div></div>
      </div>

      <h2 style={{ marginTop: 28 }}>Funnel events (30d)</h2>
      {m.events.length === 0 ? (
        <div className="empty">No events recorded yet.</div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          {m.events.map((e) => (
            <div key={e.name} style={{ margin: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <code>{e.name}</code>
                <span style={{ color: "var(--text-muted)" }}>{e.count}</span>
              </div>
              <div style={{ background: "#eef2f7", borderRadius: 999, height: 8 }}>
                <div style={{ width: `${Math.round((e.count / maxEvent) * 100)}%`, height: "100%", background: "var(--primary)", borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
