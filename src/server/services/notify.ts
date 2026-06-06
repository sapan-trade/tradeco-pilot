import { prisma } from "@/lib/db";
import { createEmailClient } from "@/server/integrations/email";
import {
  updateAffectsClassification,
  type MatchableUpdate,
} from "./regulatory-match";
import type { NotificationType } from "@prisma/client";

const email = createEmailClient();

export interface NotifyArgs {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  orgId?: string | null;
}

/** Create one in-app notification and fire a best-effort email (stubbed by default). */
export async function createNotification(userId: string, args: NotifyArgs) {
  const n = await prisma.notification.create({
    data: {
      userId,
      orgId: args.orgId ?? null,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link ?? null,
    },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email) {
    // Never let email failures break the originating action.
    email.send({ to: user.email, subject: args.title, text: args.body }).catch((e) => {
      console.error("[notify] email send failed:", e?.message ?? e);
    });
  }
  return n;
}

/** Notify every member of an org. */
export async function notifyOrgMembers(orgId: string, args: NotifyArgs) {
  const members = await prisma.membership.findMany({ where: { orgId }, select: { userId: true } });
  await Promise.all(members.map((m) => createNotification(m.userId, { ...args, orgId })));
}

/**
 * For a newly-ingested regulatory update, notify every org whose catalog it touches.
 * Scans classifications in memory (fine at pilot scale; prefix matching is awkward in SQL).
 */
export async function notifyCatalogMatchesForUpdate(update: MatchableUpdate & { title: string }) {
  if (update.affectedHs.length === 0) return 0;
  const classifications = await prisma.classification.findMany({
    select: { id: true, skuId: true, hsCode: true, destination: true, orgId: true },
  });
  const affectedOrgIds = new Set<string>();
  for (const c of classifications) {
    if (
      updateAffectsClassification(update, {
        id: c.id,
        skuId: c.skuId,
        hsCode: c.hsCode,
        destination: c.destination,
        skuTitle: "",
      })
    ) {
      affectedOrgIds.add(c.orgId);
    }
  }
  for (const orgId of affectedOrgIds) {
    await notifyOrgMembers(orgId, {
      type: "REGULATORY_ALERT",
      title: "Regulatory change affects your catalog",
      body: update.title,
      link: "/regulatory",
    });
  }
  return affectedOrgIds.size;
}
