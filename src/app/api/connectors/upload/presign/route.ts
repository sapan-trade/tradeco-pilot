import { NextResponse } from "next/server";
import { getObjectStore } from "@/server/integrations/s3";
import { getRateLimiter } from "@/server/integrations/ratelimit";

export async function POST(req: Request) {
  const orgId = req.headers.get("x-test-org");
  if (!orgId) return NextResponse.json({ error: "no org context" }, { status: 401 });

  const rl = await getRateLimiter().consume(`upload-presign:${orgId}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind === "image" ? "image" : "csv";
  const result = await getObjectStore().presignUpload({ kind, orgId });
  return NextResponse.json(result);
}
