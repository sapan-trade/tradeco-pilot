import Link from "next/link";
import { getServerCaller } from "@/lib/server-caller";

const usd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_LABELS: Record<string, string> = {
  AUTO_APPROVED: "Auto-approved",
  NEEDS_REVIEW: "Needs review",
  BROKER_APPROVED: "Broker approved",
  BROKER_REJECTED: "Broker rejected",
  OVERRIDDEN: "Overridden",
  PENDING: "Pending",
};
const STATUS_COLORS: Record<string, string> = {
  AUTO_APPROVED: "#10b981",
  NEEDS_REVIEW: "#f59e0b",
  BROKER_APPROVED: "#4f46e5",
  BROKER_REJECTED: "#ef4444",
  OVERRIDDEN: "#6366f1",
  PENDING: "#94a3b8",
};

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{count} · {pct}%</span>
      </div>
      <div style={{ background: "#eef2f7", borderRadius: 999, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const a = await caller.analytics.summary();

  const statusEntries = Object.entries(a.statusCounts).sort((x, y) => y[1] - x[1]);
  const maxChapter = Math.max(1, ...a.topChapters.map((c) => c.count));

  return (
    <>
      <h1>Analytics</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
        Your classification, duty exposure, and broker activity at a glance.
      </p>

      {a.totalClassified === 0 ? (
        <div className="empty">
          No data yet. <Link href="/skus">Add and classify a product</Link> to see analytics.
        </div>
      ) : (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-card-label">Products classified</div>
              <div className="stat-card-value">{a.totalClassified}</div>
              <div className="stat-card-sub">avg confidence {a.avgConfidencePct}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Estimated duty exposure</div>
              <div className="stat-card-value">{usd(a.estimatedDutyCents)}</div>
              <div className="stat-card-sub">{usd(a.estimatedLandedCents)} total landed</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">FTA-eligible</div>
              <div className="stat-card-value">{a.ftaEligibleCount}</div>
              <div className="stat-card-sub">classifications with a trade-program match</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Broker turnaround</div>
              <div className="stat-card-value">{a.avgTurnaroundHours == null ? "—" : `${a.avgTurnaroundHours}h`}</div>
              <div className="stat-card-sub">{a.brokerDecidedCount} reviews decided</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginTop: 28 }}>
            <div>
              <h2>Classification mix</h2>
              {statusEntries.map(([status, count]) => (
                <Bar
                  key={status}
                  label={STATUS_LABELS[status] ?? status}
                  count={count}
                  total={a.totalClassified}
                  color={STATUS_COLORS[status] ?? "#94a3b8"}
                />
              ))}
            </div>

            <div>
              <h2>Top HS chapters</h2>
              {a.topChapters.length === 0 ? (
                <div className="empty">No codes yet.</div>
              ) : (
                a.topChapters.map((c) => (
                  <Bar key={c.chapter} label={`Heading ${c.chapter}`} count={c.count} total={maxChapter} color="#4f46e5" />
                ))
              )}
            </div>
          </div>

          <h2 style={{ marginTop: 24 }}>Declarations</h2>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-card-label">Drafts</div>
              <div className="stat-card-value">{a.declarations.draft}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Submitted</div>
              <div className="stat-card-value">{a.declarations.submitted}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Total</div>
              <div className="stat-card-value">{a.declarations.total}</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
