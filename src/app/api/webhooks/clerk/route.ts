import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";
import type { OrgRole } from "@prisma/client";

interface ClerkEvent {
  type: string;
  data: any;
}

function mapClerkRole(role: string): OrgRole {
  if (role === "org:admin") return "OWNER";
  return "MEMBER";
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  const body = await req.text();

  let event: ClerkEvent;
  if (secret) {
    const wh = new Webhook(secret);
    const headers = {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    };
    try {
      event = wh.verify(body, headers) as ClerkEvent;
    } catch {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
  } else {
    console.warn("[clerk-webhook] CLERK_WEBHOOK_SECRET unset; accepting unverified payload (dev only).");
    event = JSON.parse(body) as ClerkEvent;
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const email = event.data.email_addresses?.[0]?.email_address ?? `${event.data.id}@unknown.local`;
      const name = [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null;
      await prisma.user.upsert({
        where: { id: event.data.id },
        create: { id: event.data.id, email, name },
        update: { email, name: name ?? undefined },
      });
      break;
    }
    case "organization.created":
    case "organization.updated": {
      const country = event.data.public_metadata?.country ?? "US";
      await prisma.organization.upsert({
        where: { id: event.data.id },
        create: { id: event.data.id, name: event.data.name, country },
        update: { name: event.data.name },
      });
      break;
    }
    case "organizationMembership.created": {
      await prisma.membership.upsert({
        where: {
          userId_orgId: {
            userId: event.data.public_user_data.user_id,
            orgId: event.data.organization.id,
          },
        },
        create: {
          userId: event.data.public_user_data.user_id,
          orgId: event.data.organization.id,
          role: mapClerkRole(event.data.role),
        },
        update: { role: mapClerkRole(event.data.role) },
      });
      break;
    }
    default:
      console.log(`[clerk-webhook] ignored event type ${event.type}`);
  }

  return NextResponse.json({ ok: true });
}
