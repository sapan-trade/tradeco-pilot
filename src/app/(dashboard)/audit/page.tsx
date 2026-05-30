import { getServerCaller } from "@/lib/server-caller";

export default async function AuditPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  if (ctx.org.role !== "OWNER" && ctx.org.role !== "ADMIN") {
    return <div className="note">OWNER or ADMIN role required.</div>;
  }
  const { items } = await caller.audit.list({});
  return (
    <>
      <h1>Audit log</h1>
      <p style={{ color: "#6b7280" }}>
        Append-only, SHA-256 hash chain per org. Most recent first.
      </p>
      {items.length === 0 ? (
        <div className="empty">No audit events yet.</div>
      ) : (
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Subject</th><th>User</th><th>Hash</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td style={{ fontSize: 12, color: "#6b7280" }}>{new Date(a.createdAt).toLocaleString()}</td>
                <td><code>{a.action}</code></td>
                <td style={{ fontSize: 12 }}>{a.subject}</td>
                <td style={{ fontSize: 12 }}>{a.userId ?? "—"}</td>
                <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7280" }}>
                  {a.hash.slice(0, 12)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
