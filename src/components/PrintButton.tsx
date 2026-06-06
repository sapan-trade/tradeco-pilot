"use client";

/** Triggers the browser print dialog (which can "Save as PDF"). Hidden when printing. */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
