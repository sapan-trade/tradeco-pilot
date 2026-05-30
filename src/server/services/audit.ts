import crypto from "node:crypto";
import { prisma } from "@/lib/db";

export interface AuditEvent {
  orgId: string;
  userId?: string | null;
  action: string;
  subject: string;
  payload: unknown;
}

/**
 * Append-only audit write with SHA-256 hash chain (per org).
 * Reads the most recent hash, computes `sha256(prevHash | canonical(payload) | timestamp)`,
 * and inserts. No locks in Phase 1; tests run sequentially. Phase 4 adds row-level locking.
 */
export async function writeAuditLog(evt: AuditEvent): Promise<void> {
  const prev = await prisma.auditLog.findFirst({
    where: { orgId: evt.orgId },
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  const ts = new Date();
  const canonical = canonicalize({
    orgId: evt.orgId,
    userId: evt.userId ?? null,
    action: evt.action,
    subject: evt.subject,
    payload: evt.payload,
    ts: ts.toISOString(),
  });
  const hash = crypto
    .createHash("sha256")
    .update((prev?.hash ?? "") + "|" + canonical)
    .digest("hex");

  await prisma.auditLog.create({
    data: {
      orgId: evt.orgId,
      userId: evt.userId ?? null,
      action: evt.action,
      subject: evt.subject,
      payload: evt.payload as object,
      prevHash: prev?.hash ?? null,
      hash,
      createdAt: ts,
    },
  });
}

function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalize((obj as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}
