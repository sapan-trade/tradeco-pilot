import Link from "next/link";
import { getServerCaller } from "@/lib/server-caller";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function MarketplacePage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.user) return <div className="note">Not authenticated.</div>;

  let queue;
  try {
    queue = await caller.marketplace.queue();
  } catch {
    return (
      <div className="note">
        The marketplace is open to approved brokers only.{" "}
        <Link href="/broker/dashboard">Check your application status</Link>.
      </div>
    );
  }

  return (
    <>
      <h1>Marketplace</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        Pooled review cases across all merchants. You earn{" "}
        <strong>{usd(queue.feeCents)}</strong> per completed review.
      </p>

      {queue.items.length === 0 ? (
        <div className="empty">No cases waiting right now. Check back soon.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Merchant</th>
              <th>Predicted HS</th>
              <th>Dest</th>
              <th>Confidence</th>
              <th>Fee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {queue.items.map((r) => (
              <tr key={r.reviewId}>
                <td>{r.sku.title}</td>
                <td style={{ color: "var(--text-secondary)" }}>{r.orgName}</td>
                <td><code>{r.predictedHsCode}</code></td>
                <td>{r.destination}</td>
                <td><ConfidenceBadge value={r.confidence} /></td>
                <td>{usd(queue.feeCents)}</td>
                <td>
                  <Link href={`/broker/marketplace/${r.reviewId}`}>
                    {r.claimedByMe ? "Continue" : "Open"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
