import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const session = await auth().catch(() => ({ userId: null as string | null }));
  const signedIn = !!session.userId;

  return (
    <main style={{ padding: 48, maxWidth: 720, margin: "0 auto" }}>
      <h1>TradeCo-Pilot</h1>
      <p>AI cross-border trade compliance for SMB importers and exporters.</p>

      {signedIn ? (
        <div style={{ marginTop: 24 }}>
          <Link
            href="/dashboard"
            style={{ padding: "10px 16px", background: "#2563eb", color: "#fff", borderRadius: 4 }}
          >
            Go to dashboard
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Link
            href="/sign-up"
            style={{ padding: "10px 16px", background: "#2563eb", color: "#fff", borderRadius: 4 }}
          >
            Sign up
          </Link>
          <Link
            href="/sign-in"
            style={{ padding: "10px 16px", border: "1px solid #2563eb", color: "#2563eb", borderRadius: 4 }}
          >
            Sign in
          </Link>
        </div>
      )}
    </main>
  );
}
