import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { SubmitButton } from "@/components/SubmitButton";

function typeLabel(t: string) {
  if (t === "REGULATORY_ALERT") return "CRITICAL";
  if (t === "BROKER_DECISION") return "INFO";
  return "INFO";
}

export default async function NotificationsPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.user) return <div className="note" style={{ margin: 48 }}>Not signed in.</div>;

  const { items } = await caller.notification.list({});

  async function markAllRead() {
    "use server";
    const { caller } = await getServerCaller();
    await caller.notification.markAllRead();
    revalidatePath("/notifications");
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Notifications</h1>
        {items.some((n) => !n.read) && (
          <form action={markAllRead} className="inline">
            <SubmitButton className="ghost" pendingText="…">Mark all read</SubmitButton>
          </form>
        )}
      </div>

      <p style={{ marginTop: 8 }}>
        <Link href="/dashboard">← Tenant app</Link>
        <span style={{ color: "var(--text-muted)" }}> · </span>
        <Link href="/broker/dashboard">Broker portal</Link>
      </p>

      {items.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>No notifications yet.</div>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((n) => {
            const inner = (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusPill status={typeLabel(n.type)} />
                  <strong style={{ fontWeight: n.read ? 400 : 700 }}>{n.title}</strong>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--primary)" }} />}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{n.body}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </>
            );
            const cardStyle: React.CSSProperties = {
              padding: 14,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              background: n.read ? "#fff" : "var(--primary-50)",
              display: "block",
            };
            return n.link ? (
              <Link key={n.id} href={n.link} style={{ ...cardStyle, color: "inherit" }}>{inner}</Link>
            ) : (
              <div key={n.id} style={cardStyle}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
