# Go-Live Runbook

Production deploys automatically from `main` on Vercel. The app is functional in **test
mode** today (Clerk test keys, Stripe test keys, real Claude). This runbook covers the
config needed to serve **real users and real payments**. Everything below is set in an
external dashboard — no code changes required.

Set all env vars in **Vercel → Project → Settings → Environment Variables** (Production),
then redeploy.

---

## ✅ Already live
- App deployed (auto-deploy on push to `main`), production returns 200.
- Neon Postgres — schema in sync.
- Real Claude classification (`USE_REAL_AI=1`, `ANTHROPIC_API_KEY` set).
- Daily regulatory ingest + catalog alerts — `vercel.json` cron → `/api/cron/regulatory`.
- Sentry, Upstash (rate limiting) configured.

---

## 🔴 Required for real customers / real money

### 1. Clerk → production instance
You're on test keys (`pk_test…`). Real users need a Clerk **production** instance.
- Create the production instance in the Clerk dashboard.
- Set in Vercel: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…`, `CLERK_SECRET_KEY=sk_live_…`.
- Add a Clerk webhook → `https://<your-domain>/api/webhooks/clerk`, copy its signing secret to
  `CLERK_WEBHOOK_SECRET`.

### 2. Stripe → live mode
Currently test keys (`sk_test…`).
- Set `STRIPE_SECRET_KEY=sk_live_…`.
- Recreate the three subscription prices in live mode and set:
  - `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`
  - ⚠️ **Fix the duplicate** — today `STRIPE_PRICE_PRO` equals `STRIPE_PRICE_STARTER`. PRO must
    point at its own price.
- Register a webhook → `https://<your-domain>/api/webhooks/stripe`, copy the signing secret to
  `STRIPE_WEBHOOK_SECRET`. Subscribe to these events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `account.updated`  ← required for broker payout onboarding

### 3. Enable Stripe Connect
Broker payouts use Connect transfers. Enable Connect in the Stripe dashboard (Connect →
Get started). Until then, the payout flow runs on the deterministic stub.

### 4. CRON_SECRET
Set `CRON_SECRET` to any random string in Vercel. Vercel Cron automatically sends it as
`Authorization: Bearer <CRON_SECRET>`; the `/api/cron/regulatory` route verifies it.

---

## 🟡 Recommended
- **Email notifications**: set `RESEND_API_KEY` (resend.com) + `EMAIL_FROM` (a verified sender,
  e.g. `TradeCo-Pilot <alerts@yourdomain.com>`). Without these, notifications are in-app only.
- **Custom domain**: add it in Vercel → Domains, then update `NEXT_PUBLIC_APP_URL` to match
  (used in Stripe redirects and Shopify OAuth callbacks).

---

## ⚪ Optional
- **Inngest** (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`): only needed for durable
  declaration-metering events. The regulatory cron does not depend on it.
- **Shopify production app**: to let merchants install from the Shopify side, configure an app
  listing / managed install in the Shopify Partner dashboard.

---

## Post-config smoke test
1. Sign up a fresh account → create an org.
2. Add a product (in dollars) → **Classify** → confirm a result + status.
3. **Draft declaration** on an approved one → **View / print invoice**.
4. Apply as a broker (separate account) → approve via `/admin/brokers` → Stripe onboarding.
5. Trigger a test Stripe webhook (Stripe CLI or dashboard) → confirm a `Subscription` row.
6. Hit `/api/cron/regulatory` with the `CRON_SECRET` bearer → confirm it returns counts.

## Env var reference
See `.env.example` for the full list with inline notes.
