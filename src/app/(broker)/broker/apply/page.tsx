import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { SubmitButton } from "@/components/SubmitButton";

export default async function BrokerApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.user) return <div className="note">Not authenticated.</div>;

  // Already applied? Send them to their dashboard.
  const me = await caller.brokerPortal.me();
  if (me) redirect("/broker/dashboard");

  const sp = await searchParams;

  async function apply(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    const licenseNumber = String(formData.get("licenseNumber") ?? "").trim();
    const licenseCountry = String(formData.get("licenseCountry") ?? "").trim().toUpperCase();
    if (licenseNumber.length < 3 || licenseCountry.length !== 2) {
      redirect("/broker/apply?error=invalid");
    }
    try {
      await caller.brokerPortal.applyAsBroker({ licenseNumber, licenseCountry });
    } catch {
      redirect("/broker/apply?error=failed");
    }
    redirect("/broker/dashboard");
  }

  return (
    <>
      <h1>Become a broker</h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: 560 }}>
        Earn money reviewing AI tariff classifications. Submit your customs-broker license for
        verification. Once an admin approves you and you finish Stripe payout setup, you can claim
        cases from the marketplace and get paid a flat fee per completed review.
      </p>

      {sp.error && (
        <div className="note">
          {sp.error === "invalid"
            ? "Enter a valid license number and a 2-letter country code."
            : "Could not submit your application — you may have already applied."}
        </div>
      )}

      <form action={apply} className="stack">
        <label>
          Customs-broker license number
          <input name="licenseNumber" placeholder="e.g. CB-123456" required minLength={3} />
        </label>
        <label>
          License country (ISO-2)
          <input name="licenseCountry" placeholder="US" required maxLength={2} />
        </label>
        <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
      </form>

      <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 560 }}>
        Identity and bank details are collected securely by Stripe during payout onboarding —
        we never store them. License approval confirms your professional credential.
      </p>
    </>
  );
}
