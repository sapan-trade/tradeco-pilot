"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";

type State = { key?: string; prefix?: string; error?: string } | null;

export function CreateApiKey({
  action,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <>
      <form action={formAction} className="stack">
        <label>
          Key name
          <input name="name" required placeholder="Production server" maxLength={60} />
        </label>
        <SubmitButton pendingText="Creating…">Create API key</SubmitButton>
      </form>

      {state?.error && <div className="banner banner-error">{state.error}</div>}
      {state?.key && (
        <div className="banner banner-success">
          <strong>Copy your key now — it won&apos;t be shown again.</strong>
          <pre
            style={{
              marginTop: 8,
              padding: 10,
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 6,
              fontSize: 13,
              overflowX: "auto",
            }}
          >
            {state.key}
          </pre>
        </div>
      )}
    </>
  );
}
