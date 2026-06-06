import { NextResponse } from "next/server";
import { sendWeeklyDigests } from "@/server/services/digest";

/**
 * Weekly per-org digest. Triggered by Vercel Cron (see vercel.json).
 * Vercel signs cron requests with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendWeeklyDigests();
  return NextResponse.json({ ok: true, ...result });
}
