import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
