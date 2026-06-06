import Link from "next/link";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";

export default async function RegulatoryPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const [{ items }, alerts] = await Promise.all([
    caller.regulatory.list({}),
    caller.regulatory.alertsForOrg(),
  ]);

  return (
    <>
      <h1>Regulatory updates</h1>
      <p style={{ color: "#6b7280" }}>
        Pulled daily from federalregister.gov by the <code>ingest-regulatory</code> cron.
      </p>

      <h2 style={{ marginTop: 8 }}>
        Affecting your catalog{" "}
        {alerts.alertCount > 0 && (
          <span className="pill pill-needs" style={{ marginLeft: 6 }}>{alerts.alertCount}</span>
        )}
      </h2>
      {alerts.alertCount === 0 ? (
        <div className="empty">
          Nothing in the feed currently touches your classified products. Good news — we&apos;ll flag
          it here the moment something does.
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          {alerts.affectedSkuCount} product(s) in your catalog are affected by recent rule changes.
        </p>
      )}

      {alerts.alerts.map((a) => (
        <div key={a.id} className="feature-card" style={{ margin: "12px 0", padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <StatusPill status={a.severity} />
            <strong>{a.title}</strong>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
            HS {a.affectedHs.join(", ") || "—"} · {new Date(a.publishedAt).toLocaleDateString()} ·{" "}
            <a href={a.url} target="_blank" rel="noreferrer">Read the notice ↗</a>
          </div>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)" }}>Your affected products: </span>
            {a.products.map((p, i) => (
              <span key={p.skuId}>
                {i > 0 && ", "}
                <Link href={`/skus/${p.skuId}`}>{p.title}</Link> <code style={{ fontSize: 12 }}>{p.hsCode}</code>
              </span>
            ))}
            {a.moreProducts > 0 && <span> +{a.moreProducts} more</span>}
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 24 }}>All updates</h2>
      {items.length === 0 ? (
        <div className="empty">No updates ingested yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Title</th><th>Severity</th><th>Affected HS</th><th>Published</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.title}</td>
                <td><StatusPill status={u.severity} /></td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>{u.affectedHs.join(", ") || "—"}</td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>
                  {new Date(u.publishedAt).toLocaleDateString()}
                </td>
                <td><a href={u.url} target="_blank" rel="noreferrer">Open</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
