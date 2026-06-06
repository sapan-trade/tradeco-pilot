import { NextResponse } from "next/server";
import { verifyApiKey } from "@/server/services/api-keys";
import { classifyViaApi } from "@/server/services/api-classify";
import { getRateLimiter } from "@/server/integrations/ratelimit";

// Calls Claude inline; allow up to 60s.
export const maxDuration = 60;

/**
 * POST /api/v1/classify
 * Authorization: Bearer tcp_...
 * Body: { title, description?, supplierCountry?, unitValueCents?, destination? }
 */
export async function POST(req: Request) {
  const authz = req.headers.get("authorization");
  const raw = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
  const key = await verifyApiKey(raw);
  if (!key) {
    return NextResponse.json({ error: "invalid or missing API key" }, { status: 401 });
  }

  const rl = await getRateLimiter().consume(`api:${key.orgId}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "`title` is required" }, { status: 400 });
  }

  try {
    const result = await classifyViaApi(key.orgId, {
      title,
      description: typeof body.description === "string" ? body.description : null,
      supplierCountry: typeof body.supplierCountry === "string" ? body.supplierCountry : null,
      unitValueCents: Number.isInteger(body.unitValueCents) ? body.unitValueCents : null,
      destination: typeof body.destination === "string" ? body.destination : undefined,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "classification failed" }, { status: 500 });
  }
}
