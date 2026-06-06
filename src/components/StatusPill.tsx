export function StatusPill({ status }: { status: string }) {
  const cls = (() => {
    switch (status) {
      case "PENDING": return "pill pill-pending";
      case "AUTO_APPROVED": return "pill pill-auto";
      case "NEEDS_REVIEW": return "pill pill-needs";
      case "BROKER_APPROVED": return "pill pill-approved";
      case "BROKER_REJECTED": return "pill pill-rejected";
      case "APPROVED": return "pill pill-auto";
      case "SUSPENDED": return "pill pill-needs";
      case "PAID": return "pill pill-auto";
      case "FAILED": return "pill pill-needs";
      case "OVERRIDDEN": return "pill pill-approved";
      case "DRAFT": return "pill pill-draft";
      case "SUBMITTED": return "pill pill-submitted";
      case "ACCEPTED": return "pill pill-approved";
      case "REJECTED": return "pill pill-rejected";
      case "ACTIVE": return "pill pill-active";
      case "TRIALING": return "pill pill-active";
      case "PAST_DUE": return "pill pill-needs";
      case "CANCELED": return "pill pill-rejected";
      case "INACTIVE": return "pill pill-inactive";
      default: return "pill pill-inactive";
    }
  })();
  return <span className={cls}>{status}</span>;
}
