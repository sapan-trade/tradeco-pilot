/**
 * Email seam. Stub (console) by default; swaps to Resend when RESEND_API_KEY is set.
 * Mirrors the project's other dual-mode integrations so nothing external is hit in tests.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailClient {
  send(msg: EmailMessage): Promise<void>;
}

class StubEmailClient implements EmailClient {
  async send(msg: EmailMessage) {
    console.log(`[email-stub] TODO: wire a real provider. to=${msg.to} subject="${msg.subject}"`);
  }
}

class ResendEmailClient implements EmailClient {
  constructor(private apiKey: string, private from: string) {}
  async send(msg: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: msg.to, subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend send failed: ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
    }
  }
}

let cached: EmailClient | null = null;

export function createEmailClient(): EmailClient {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Clearwise <alerts@clearwise.app>";
  const useReal = key && process.env.NODE_ENV !== "test";
  cached = useReal ? new ResendEmailClient(key!, from) : new StubEmailClient();
  return cached;
}
