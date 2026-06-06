"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that reflects the parent <form>'s pending state, so slow server
 * actions (e.g. classification, which calls Claude for 5-15s) show "Working…"
 * and disable instead of looking like a dead click.
 */
export function SubmitButton({
  children,
  pendingText = "Working…",
  className,
  name,
  value,
  disabled,
  confirm,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
  /** If set, ask for confirmation before the form submits (e.g. actions that cost money). */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? pendingText : children}
    </button>
  );
}
