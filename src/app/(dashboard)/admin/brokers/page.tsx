import { revalidatePath } from "next/cache";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";

export default async function AdminBrokersPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  if (ctx.org.role !== "ADMIN") {
    return <div className="note">Admin role required to review broker applications.</div>;
  }

  const brokers = await caller.adminBrokers.list({});

  async function approve(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    await caller.adminBrokers.approve({ brokerId: String(formData.get("brokerId")) });
    revalidatePath("/admin/brokers");
  }

  async function reject(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const reason = String(formData.get("reason") ?? "").trim() || "Not approved";
    await caller.adminBrokers.reject({ brokerId: String(formData.get("brokerId")), reason });
    revalidatePath("/admin/brokers");
  }

  const pending = brokers.filter((b) => b.status === "PENDING");
  const others = brokers.filter((b) => b.status !== "PENDING");

  return (
    <>
      <h1>Broker applications</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        Verify the customs-broker license, then approve or reject. Identity &amp; bank are handled
        separately by Stripe Connect onboarding.
      </p>

      <h2 style={{ marginTop: 20 }}>Pending ({pending.length})</h2>
      {pending.length === 0 ? (
        <div className="empty">No applications waiting.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Applicant</th><th>License</th><th>Country</th><th>Applied</th><th>Decision</th></tr>
          </thead>
          <tbody>
            {pending.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.name ?? b.email}
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.email}</div>
                </td>
                <td><code>{b.licenseNumber}</code></td>
                <td>{b.licenseCountry}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {new Date(b.appliedAt).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <form action={approve} className="inline">
                      <input type="hidden" name="brokerId" value={b.id} />
                      <button type="submit">Approve</button>
                    </form>
                    <form action={reject} className="inline" style={{ display: "flex", gap: 4 }}>
                      <input type="hidden" name="brokerId" value={b.id} />
                      <input name="reason" placeholder="Reason" style={{ width: 120 }} />
                      <button type="submit" className="danger">Reject</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 28 }}>Reviewed ({others.length})</h2>
      {others.length === 0 ? (
        <div className="empty">None yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Applicant</th><th>License</th><th>Status</th><th>Payouts</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {others.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.name ?? b.email}
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.email}</div>
                </td>
                <td><code>{b.licenseNumber}</code></td>
                <td><StatusPill status={b.status} /></td>
                <td>{b.payoutsEnabled ? "✓ ready" : b.stripeConnected ? "in progress" : "—"}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.rejectionReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
