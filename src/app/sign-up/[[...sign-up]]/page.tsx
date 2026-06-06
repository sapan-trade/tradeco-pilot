import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 16 }}>
      <SignUp fallbackRedirectUrl="/dashboard" />
      <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 380, textAlign: "center" }}>
        By creating an account you agree to our <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>. HS classifications are advisory, not legal or
        customs advice.
      </p>
    </div>
  );
}
