import { NextResponse } from "next/server";
import { getObjectStore } from "@/server/integrations/s3";

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  await getObjectStore().putObject(token, buf, req.headers.get("content-type") ?? undefined);
  return NextResponse.json({ ok: true, bytes: buf.length });
}
