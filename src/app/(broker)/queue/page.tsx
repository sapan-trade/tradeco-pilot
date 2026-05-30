import Link from "next/link";
import { getServerCaller } from "@/lib/server-caller";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

export default async function BrokerQueuePage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  if (ctx.org.role !== "BROKER" && ctx.org.role !== "ADMIN") {
    return <div className="note">Broker role required.</div>;
  }
  const { items } = await caller.broker.queue();

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>Broker</h2>
        <Link href="/queue">Queue</Link>
      </nav>
      <main className="main">
        <h1>Review queue</h1>
        {items.length === 0 ? (
          <div className="empty">Nothing waiting.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Predicted HS</th>
                <th>Dest</th>
                <th>Confidence</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.reviewId}>
                  <td>{r.sku.title}</td>
                  <td><code>{r.predictedHsCode}</code></td>
                  <td>{r.destination}</td>
                  <td><ConfidenceBadge value={r.confidence} /></td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{new Date(r.createdAt).toLocaleString()}</td>
                  <td><Link href={`/case/${r.reviewId}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
