import { NextResponse } from "next/server";

/**
 * TEMPORARY debug endpoint — returns prefix/suffix of Shopify env values so
 * we can compare what's actually live on Vercel vs what's in Shopify Partners.
 * DELETE this file once the connector is working.
 */
export async function GET() {
  const key = process.env.SHOPIFY_API_KEY ?? "";
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  return NextResponse.json({
    apiKey: {
      length: key.length,
      prefix: key.slice(0, 10),
      suffix: key.slice(-4),
      sha256_first8: key.length > 0 ? require("node:crypto").createHash("sha256").update(key).digest("hex").slice(0, 8) : null,
    },
    apiSecret: {
      length: secret.length,
      prefix: secret.slice(0, 10),
      suffix: secret.slice(-4),
      sha256_first8: secret.length > 0 ? require("node:crypto").createHash("sha256").update(secret).digest("hex").slice(0, 8) : null,
    },
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    expectedKey: "be72eaab90...e2f7",
    expectedSecret: "shpss_4cb2...c150",
  });
}
