// Verifies that the SHOPIFY_API_KEY + SHOPIFY_API_SECRET in .env are recognized by Shopify.
// We send a token-exchange request with a deliberately fake code.
//   - If creds are recognized: Shopify returns { error: "invalid_request" } (it can validate the secret, just doesn't recognize the code).
//   - If creds are wrong: Shopify returns 401 with { error: "invalid_client" } or similar.

const shop = "tradeco-dev.myshopify.com";

async function main() {
  const key = process.env.SHOPIFY_API_KEY;
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!key || !secret) {
    console.error("Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET in .env");
    process.exit(1);
  }
  console.log(`Testing key prefix: ${key.slice(0, 8)}...${key.slice(-4)}`);
  console.log(`Testing secret prefix: ${secret.slice(0, 10)}...${secret.slice(-4)}`);

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: key,
      client_secret: secret,
      code: "fake-test-code-just-checking-creds",
    }),
  });
  const body = await res.text();
  console.log(`\nHTTP ${res.status}`);
  console.log(`Response body: ${body}`);

  if (res.status === 401 || body.includes("invalid_client")) {
    console.log("\n❌ Credentials NOT recognized by Shopify. The key/secret pair is wrong.");
  } else if (res.status === 400 && body.includes("invalid_request")) {
    console.log("\n✅ Credentials are valid (Shopify recognized the pair). The 400 in prod is from the consumed code, not the secret.");
  } else {
    console.log("\n? Unclear result — interpret manually.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
