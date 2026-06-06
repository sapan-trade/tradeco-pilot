import Link from "next/link";

/**
 * Standard advisory disclaimer shown wherever the product outputs a classification
 * or customs document. Shifts the "this is advice" risk: AI suggestions are advisory,
 * the user is the declarant of record, broker review is the verification path.
 */
export function Disclaimer({ variant = "classification" }: { variant?: "classification" | "filing" }) {
  return (
    <p
      style={{
        fontSize: 12,
        color: "var(--text-muted)",
        borderLeft: "3px solid var(--border-strong)",
        paddingLeft: 10,
        margin: "12px 0",
        lineHeight: 1.5,
      }}
    >
      {variant === "filing" ? (
        <>
          This document is a generated draft, not a filed customs entry. You are the declarant of
          record and are responsible for the accuracy of all data submitted to customs authorities.
        </>
      ) : (
        <>
          AI-suggested HS codes are <strong>advisory and not legal, customs, or tax advice</strong>.
          Final classification is your responsibility — have low-confidence items{" "}
          <strong>verified by a licensed customs broker</strong> before filing.
        </>
      )}{" "}
      See <Link href="/terms">Terms</Link>.
    </p>
  );
}
