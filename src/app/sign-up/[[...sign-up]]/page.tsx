import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <SignUp fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
