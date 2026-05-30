import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";

export default async function RegulatoryPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const { items } = await caller.regulatory.list({});
  return (
    <>
      <h1>Regulatory updates</h1>
      <p style={{ color: "#6b7280" }}>
        Pulled daily from federalregister.gov by the <code>ingest-regulatory</code> cron.
      </p>
      {items.length === 0 ? (
        <div className="empty">No updates ingested yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Title</th><th>Severity</th><th>Source</th><th>Published</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.title}</td>
                <td><StatusPill status={u.severity} /></td>
                <td>{u.source}</td>
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
