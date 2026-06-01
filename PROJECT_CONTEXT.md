# TradeCo-Pilot — Project Context & Handoff

> Single-source reference for any human or AI that needs to understand this codebase from scratch.
> Last updated: 2026-05-31

---

## 0. TL;DR

- **Name:** TradeCo-Pilot
- **What it is:** AI cross-border trade compliance co-pilot for SMB importers/exporters. Classifies products to 10-digit HS codes, computes landed cost, generates customs declarations, routes low-confidence cases to human brokers.
- **Stack:** Next.js 15 (App Router) + tRPC + Prisma + Postgres + Tailwind-less inline CSS + Clerk + Stripe + Anthropic Claude Sonnet 4.6 + Shopify.
- **Live URL:** https://tradeco-pilot-h9ys.vercel.app
- **Repo:** https://github.com/sapan-trade/tradeco-pilot (private)
- **Owner:** Sapan, killerbeepubg0002@gmail.com
- **Status:** Production-deployed. End-to-end working: sign-up via Clerk, classify with real Claude, subscribe via real Stripe. Pending: secrets rotation (T17), backup drill (T18), dashboards (T19), runbook (T20).

---

## 1. Business Context

From the blueprint PDF:

- **Problem:** SMB cross-border shippers face volatile tariffs, complex HS classification, high audit risk. Existing enterprise tools (Avalara, Descartes, Thomson Reuters) are too expensive and IT-heavy.
- **Solution:** Lightweight AI-driven SaaS that classifies products to 10-digit HS, scores confidence, computes landed cost, routes low-confidence to a human broker network for audit defensibility.
- **ICP:** SMBs $1M–$50M revenue — DTC brands, Amazon sellers, small manufacturers, 3PLs.
- **Pricing:** Starter $299/mo (500 SKUs), Growth $799/mo (5k SKUs), Pro $2,499/mo (unlimited). Plus $3 per-declaration fee.
- **Why now:** Post-2025 permanent geopolitical tariffing, CBAM enforcement, nearshoring churn, multimodal AI maturity.

---

## 2. Tech Stack (Final)

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 15 App Router (RSC) | Single-process server + UI; server actions instead of separate API for mutations |
| Backend | tRPC v10 | End-to-end type safety, used both via HTTP route handler and via `appRouter.createCaller(ctx)` from server components |
| DB | Postgres (Neon Serverless) | Free tier, branching for previews, no Docker needed |
| ORM | Prisma 5 | Schema-first, `prisma db push` for fast dev iteration |
| Auth | Clerk | Hosted sign-in / sign-up / orgs, dev keys work on any domain |
| AI | Anthropic Claude Sonnet 4.6 via `@anthropic-ai/sdk` | Tool-use for structured JSON output, prompt caching on HTS catalog, vision input for images |
| Billing | Stripe (test mode currently) | Checkout sessions in subscription mode + webhook handler |
| File storage | In-memory (dev) / AWS S3 (prod, not yet wired) | `src/server/integrations/s3.ts` with stub fallback |
| Rate limiting | Upstash Redis via `@upstash/ratelimit` | Free tier; in-memory fallback |
| Error tracking | `@sentry/nextjs` | Initialized in `src/instrumentation.ts` when `SENTRY_DSN` set |
| Cron | Vercel Cron (`vercel.json`) | Daily regulatory ingest at 06:00 UTC |
| Connectors | Shopify (real OAuth wired), NetSuite/ShipStation (stub) | `src/server/integrations/` |
| Hosting | Vercel | Auto-deploy on push to `main` |
| Testing | Vitest (35 integration tests) + Playwright (e2e) | All green; tests force stub mode via NODE_ENV=test |

---

## 3. Repository Layout

```
.
├── prisma/
│   ├── schema.prisma          # Single source of truth for DB structure
│   ├── seed.ts                # No-op (HS catalog loaded at request time)
│   └── seed/hts.json          # 6-entry HS catalog stub (Phase 5: replace with real USITC HTS feed)
│
├── src/
│   ├── app/                   # Next.js 15 App Router
│   │   ├── layout.tsx         # Root: wraps with ClerkProvider, loads globals.css
│   │   ├── page.tsx           # Landing page (signed-out: sign-up/sign-in; signed-in: dashboard link)
│   │   ├── globals.css        # All CSS (no Tailwind)
│   │   ├── instrumentation.ts # Sentry init hook
│   │   │
│   │   ├── (dashboard)/       # Tenant routes, layout shows sidebar nav, requires org
│   │   │   ├── layout.tsx     # Renders OrganizationSwitcher + UserButton; maxDuration=60
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── skus/page.tsx              # CRUD + Classify form
│   │   │   ├── skus/[id]/page.tsx
│   │   │   ├── classifications/page.tsx
│   │   │   ├── declarations/page.tsx
│   │   │   ├── connectors/page.tsx        # Shopify OAuth start + CSV upload
│   │   │   ├── regulatory/page.tsx
│   │   │   ├── audit/page.tsx             # OWNER/ADMIN only
│   │   │   └── settings/billing/page.tsx  # Stripe checkout + portal
│   │   │
│   │   ├── (broker)/          # Broker routes (BROKER/ADMIN role)
│   │   │   ├── queue/page.tsx
│   │   │   └── case/[id]/page.tsx
│   │   │
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk SignIn component
│   │   ├── sign-up/[[...sign-up]]/page.tsx   # Clerk SignUp component
│   │   │
│   │   └── api/
│   │       ├── trpc/[trpc]/route.ts          # tRPC fetch handler, maxDuration=60
│   │       ├── inngest/route.ts              # Inngest serve
│   │       ├── cron/regulatory/route.ts      # Vercel Cron target, daily HTS pull
│   │       ├── webhooks/clerk/route.ts       # svix-verified Clerk webhook
│   │       ├── webhooks/stripe/route.ts      # Stripe webhook; debug logs to StripeWebhookDebug
│   │       └── connectors/
│   │           ├── shopify/start/route.ts    # OAuth begin, persists Connector row with state
│   │           ├── shopify/callback/route.ts # OAuth complete, syncs products
│   │           ├── shopify/webhook/route.ts  # HMAC-verified product webhooks
│   │           ├── upload/presign/route.ts   # Presign + rate-limited
│   │           └── upload/put/route.ts       # In-memory store ingest (dev only)
│   │
│   ├── middleware.ts          # clerkMiddleware with x-test-user bypass for tests
│   │
│   ├── components/
│   │   ├── StatusPill.tsx
│   │   └── ConfidenceBadge.tsx
│   │
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── auth.ts            # Phase 1 header-based auth (still used by tests + API HTTP)
│   │   ├── server-caller.ts   # Server-component auth: Clerk first, header fallback. Lazy-upserts User/Org/Membership.
│   │   ├── ai.ts              # generateHsCode() — real Claude or deterministic stub based on USE_REAL_AI + NODE_ENV
│   │   └── errors.ts          # apiError() — typed TRPCError factory
│   │
│   ├── server/
│   │   ├── trpc/
│   │   │   ├── init.ts        # publicProcedure / authedProcedure / orgProcedure / requireRole(...)
│   │   │   ├── context.ts     # Context type + createContext() for HTTP + createTestContext() for tests
│   │   │   └── routers/
│   │   │       ├── _app.ts    # appRouter root; exported AppRouter type
│   │   │       ├── org.ts
│   │   │       ├── sku.ts         # CRUD + bulkUpload (CSV) + importStatus
│   │   │       ├── classification.ts
│   │   │       ├── broker.ts      # queue + decide (CORRECTED|APPROVED|REJECTED)
│   │   │       ├── declaration.ts # create + submit
│   │   │       ├── landedCost.ts  # estimate
│   │   │       ├── regulatory.ts  # list
│   │   │       ├── audit.ts       # list (OWNER/ADMIN only)
│   │   │       └── billing.ts     # subscription, checkout, portal
│   │   │
│   │   ├── services/
│   │   │   ├── classifier.ts      # scheduleClassification + runClassification (inline call to AI)
│   │   │   ├── audit.ts           # writeAuditLog() with per-org SHA-256 hash chain
│   │   │   ├── rules-engine.ts    # FTA eligibility (USMCA, CPTPP, EU intra)
│   │   │   ├── landed-cost.ts     # estimateLandedCost() — duty + VAT + freight + fees
│   │   │   ├── declaration.ts     # createDeclaration + submitDeclaration + recordDeclarationUsage (Stripe meter)
│   │   │   └── csv-importer.ts    # parseCsv() + runCsvImport() (inline or via fileToken)
│   │   │
│   │   └── integrations/   # Every external system behind an interface. NODE_ENV=test ALWAYS forces stub.
│   │       ├── hts.ts             # Reads prisma/seed/hts.json (Phase 5: USITC feed)
│   │       ├── federal-register.ts # Real HTTP to federalregister.gov; tests inject fixtureFetcher
│   │       ├── shopify.ts         # Real OAuth + Admin API; stub returns 3 synthetic products
│   │       ├── stripe.ts          # Real Stripe SDK with stub fallback; constructWebhookEvent for sig verify
│   │       ├── netsuite.ts        # Stub only
│   │       ├── shipstation.ts     # Stub only
│   │       ├── broker-notifier.ts # Stub (email/SMS)
│   │       ├── s3.ts              # In-memory store; AWS_S3_BUCKET toggles real (not yet wired)
│   │       ├── ratelimit.ts       # In-memory bucket; Upstash when env set
│   │       └── sentry.ts          # captureException + setUserContext
│   │
│   └── inngest/
│       ├── client.ts          # Inngest({ id: "tradeco-pilot" })
│       └── functions/
│           ├── classify-sku.ts        # Wired but not invoked (tRPC procedure runs inline)
│           ├── ingest-regulatory.ts   # Daily cron — service exported for direct call from Vercel Cron
│           ├── meter-declarations.ts  # Wired but not invoked
│           └── import-csv.ts          # Wired but not invoked
│
├── tests/
│   ├── setup.ts               # Truncates ALL tables before each test; resets stub stores
│   ├── fixtures/sample-skus.csv
│   ├── integration/
│   │   ├── classify.spec.ts          # Phase 1 — end-to-end classify + audit chain
│   │   ├── broker.spec.ts            # Phase 2 — NEEDS_REVIEW auto-creates BrokerReview
│   │   ├── declaration.spec.ts       # Phase 2 — landed cost + submit lifecycle
│   │   ├── regulatory.spec.ts        # Phase 2 — idempotent ingest
│   │   ├── csv-import.spec.ts        # Phase 4 — bulkUpload procedure
│   │   ├── shopify.spec.ts           # Phase 4 — stub connector + sync to Sku
│   │   └── billing.spec.ts           # Phase 3 — Stripe stub URL assertions
│   └── e2e/happy-path.spec.ts        # Playwright — full UI flow with x-test-user header bypass
│
├── scripts/                   # Ad-hoc operational scripts
│   ├── smoke-ai.ts            # Hits real Claude with test SKUs (USE_REAL_AI=1)
│   ├── smoke-stripe.ts        # Creates checkout sessions against real Stripe
│   ├── smoke-shopify.ts       # Generates real Shopify OAuth install URL
│   ├── check-prod-db.ts       # Reads current production DB state
│   ├── check-webhook-debug.ts # Reads StripeWebhookDebug table
│   └── force-subscribe.ts     # Manually inserts a Subscription row (used when webhook was broken)
│
├── prisma/schema.prisma       # SOURCE OF TRUTH for DB structure
├── package.json               # scripts: dev, build (prisma generate + next build), test, test:e2e, db:*
├── tsconfig.json
├── vitest.config.ts           # excludes tests/e2e/**
├── playwright.config.ts       # auto-starts `npm run dev`
├── next.config.*              # (none — defaults)
├── vercel.json                # crons: /api/cron/regulatory at 06:00 UTC
├── docker-compose.yml         # Postgres for local dev (NOT used since we switched to Neon)
├── .env                       # Real secrets (gitignored)
├── .env.example               # Placeholders only (tracked)
└── PROJECT_CONTEXT.md         # This file
```

---

## 4. Database Schema (Prisma)

All models live in `prisma/schema.prisma`. Push changes with `npm run db:migrate` (which is `prisma db push --skip-generate`).

### Core models

| Model | Purpose |
|---|---|
| `User` | Mirror of Clerk user. Email + name + cuid id matching Clerk's `user_*`. |
| `Organization` | Tenant. Has `country`, `settings` JSON (e.g. `confidenceThreshold`). |
| `Membership` | User <-> Org with role (`OWNER`, `MEMBER`, `BROKER`, `ADMIN`). |
| `Subscription` | One per org. Tier + status from Stripe. Updated by `customer.subscription.*` and `checkout.session.completed` webhooks. |
| `Sku` | Product. `externalId = "shopify:1234"` for Shopify-sourced ones. `imageUrls`, `materials` JSON, `unitValueCents`. |
| `Classification` | One AI prediction. Holds `hsCode`, `confidence`, `rationale`, `status` (`PENDING/AUTO_APPROVED/NEEDS_REVIEW/BROKER_APPROVED/BROKER_REJECTED/OVERRIDDEN`), `inputHash`, `ftaEligible`, `ftaProgram`. |
| `BrokerReview` | Auto-created when classification goes `NEEDS_REVIEW`. `brokerUserId` is nullable until claimed. |
| `Declaration` | Customs filing. DRAFT -> SUBMITTED. Snapshots classification+landed cost into `packageJson`. Meter event fires on submit. |
| `LandedCostEstimate` | Duty/VAT/freight/fees breakdown, tied to a classification. |
| `RegulatoryUpdate` | Federal Register entries, daily ingest. Unique by `(source, externalId)`. |
| `AuditLog` | Append-only. SHA-256 hash chain per org. `prevHash` chains rows. |
| `Connector` | Per-org per-type external connection (Shopify currently). Stores `accessToken`, `shopDomain`, `scopes`, `status`. |
| `ImportJob` | Tracks CSV bulk imports. PENDING -> PROCESSING -> COMPLETED/FAILED. |
| `StripeWebhookDebug` | **Temporary** diagnostic table — every Stripe webhook logged here. Drop after T20. |

### Key invariants

- All domain data scoped by `orgId`. Anything cross-org must explicitly bypass middleware.
- `AuditLog` is append-only; hash chain detects tampering.
- `Subscription.orgId` is unique — one subscription per org.
- Tests truncate all tables in `tests/setup.ts` before each `it()`.

---

## 5. Build History (Phases 1–4)

| Phase | Scope | Tests added |
|---|---|---|
| **1** | Backend foundation: Prisma schema, tRPC routers (org/sku/classification), audit hash chain, deterministic stub classifier, multi-tenant isolation, Clerk webhook (passive) | `classify.spec.ts` |
| **2** | Broker review queue + decisions, declaration lifecycle (DRAFT→SUBMITTED), landed-cost engine, federal-register ingest, audit list endpoint | `broker.spec.ts`, `declaration.spec.ts`, `regulatory.spec.ts` |
| **3** | Server-rendered dashboard + broker UI, billing router (subscription/checkout/portal), Stripe webhook handler, Playwright e2e | `billing.spec.ts`, `tests/e2e/happy-path.spec.ts` |
| **4** | Shopify connector (OAuth + product sync + HMAC webhook), CSV bulk upload (`sku.bulkUpload` + `runCsvImport`), image inputs in classifier, presigned upload, in-memory rate limiter, Sentry seam, three new dashboard pages | `csv-import.spec.ts`, `shopify.spec.ts` |

All 35 vitest tests still green as of last verified run.

---

## 6. Integration Status (Live Prod)

| Integration | Status | Notes |
|---|---|---|
| **Neon Postgres** | LIVE | Connection in `DATABASE_URL`. Replaces Docker which Phase 1 originally targeted. |
| **Clerk** | LIVE | `pk_test_` / `sk_test_` keys. Orgs enabled. Lazy upsert in `server-caller.ts` handles missing webhook. Webhook configured on Clerk dashboard pointing to `/api/webhooks/clerk`, secret in env. |
| **Anthropic Claude** | LIVE | `claude-sonnet-4-6` via tool-use for structured JSON. Prompt caching on system prompt (HTS catalog). Real vision pipeline ready (`imageUrls` flow through). `USE_REAL_AI=1` toggle in env. NODE_ENV=test always forces stub. |
| **Stripe** | LIVE | Test mode. Products created: TradeCo-Pilot Starter ($299 CAD), Growth ($799), Pro ($2,499). All three `STRIPE_PRICE_*` envs set. ⚠️ Pro price was duplicated as Starter at first — verify before going live. Webhook endpoint `elegant-serenity-snapshot` (Snapshot payload style, not Thin). Subscription state syncs end-to-end. |
| **Shopify** | LIVE | App `TradeCo-Pilot` in Partners. Real Admin API. Redirect URI configured for `https://tradeco-pilot-h9ys.vercel.app/api/connectors/shopify/callback` + localhost. Scopes: `read_products`. Embedded mode left at `true` (cosmetic; doesn't block OAuth). |
| **Sentry** | LIVE | DSN set. `src/instrumentation.ts` initializes on server start. `captureException` no-ops in test. |
| **Upstash Redis** | LIVE | URL+token set. `getRateLimiter()` returns Upstash impl when env present. Current usage: only the `/api/connectors/upload/presign` endpoint. |
| **Vercel** | LIVE | Auto-deploy from `main` on `sapan-trade/tradeco-pilot`. Hobby plan. `maxDuration = 60s` set on the dashboard layout and `/api/trpc/[trpc]/route.ts`. Vercel Cron daily regulatory ingest. |
| **GitHub** | LIVE | Repo `sapan-trade/tradeco-pilot` (private). Push protection enabled (blocks secrets). |
| **S3** | NOT WIRED | In-memory `InMemoryObjectStore` is the active implementation. Production-fine for single-instance. Replace with `@aws-sdk/s3-request-presigner` when persistent uploads matter. |
| **HTS reference data** | STUB | 6-entry `prisma/seed/hts.json`. Claude already classifies from training (verified: Persian rug → 5701.10.9000 with no catalog hint). Real USITC HTS load is Phase 5. |
| **Inngest Cloud** | NOT WIRED | Tasks run inline via tRPC procedures. Vercel Cron handles the only scheduled job. |
| **NetSuite / ShipStation** | STUB | Interfaces exist; integration TODOs at the boundaries. |

---

## 7. Production URLs & Endpoints

- **App:** https://tradeco-pilot-h9ys.vercel.app
- **GitHub:** https://github.com/sapan-trade/tradeco-pilot
- **Neon project:** `tradeco` (free tier, US East Ohio)
- **Stripe webhook endpoint:** `elegant-serenity-snapshot` (Snapshot style)
- **Shopify app:** `TradeCo-Pilot` in Partners dashboard
- **Sentry project:** in user's Sentry account
- **Upstash database:** `tradeco-rl`

### Internal API surface (current)

| Path | Method | Notes |
|---|---|---|
| `/api/trpc/[trpc]` | GET/POST | tRPC router |
| `/api/webhooks/clerk` | POST | svix verification; user/org/membership upsert |
| `/api/webhooks/stripe` | POST | Stripe sig verify; logs every event to `StripeWebhookDebug` |
| `/api/connectors/shopify/start` | GET | OAuth begin |
| `/api/connectors/shopify/callback` | GET | OAuth complete + product sync |
| `/api/connectors/shopify/webhook` | POST | HMAC-verified product change events |
| `/api/connectors/upload/presign` | POST | Returns presigned upload URL |
| `/api/connectors/upload/put` | PUT | In-memory store ingest |
| `/api/cron/regulatory` | GET | Vercel Cron daily ingest. Bearer auth via `CRON_SECRET`. |
| `/api/inngest` | GET/POST/PUT | Inngest serve (registered functions exist but Cloud not wired) |

---

## 8. Environment Variables

`.env.example` (tracked) has placeholders. `.env` (gitignored) has real values.

### Required for prod
- `DATABASE_URL` — Neon connection string
- `NEXT_PUBLIC_APP_URL` — `https://tradeco-pilot-h9ys.vercel.app`
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`, `USE_REAL_AI=1`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`

### Optional / not wired
- `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- `CRON_SECRET` (for Vercel Cron auth)

### Vercel-specific notes
- ALL env vars must have **Production + Preview + Development** all checked.
- `NEXT_PUBLIC_*` are baked at build time → after changing them, **redeploy WITHOUT cache**.
- All other env vars are runtime → cached redeploy is fine.

---

## 9. Common Operations

### Local dev
```
cd "C:\Users\sapan\Desktop\Trader AI"
npm install
npm run db:migrate     # prisma db push
npm run db:seed        # no-op but verifies DB connectivity
npm test               # vitest, 35 tests
npm run dev            # http://localhost:3000
```

### Bypass auth in local browser
- Browser extension (ModHeader, etc.) to add `x-test-user: <id>` and `x-test-org: <id>` headers.
- The middleware skips Clerk in dev when `x-test-user` is present.
- The bypass is **disabled in production** (`NODE_ENV === "production"` check).

### Smoke tests against real services (don't touch prod data)
```
npx tsx --env-file=.env scripts/smoke-ai.ts        # hits Anthropic
npx tsx --env-file=.env scripts/smoke-stripe.ts    # creates checkout sessions
npx tsx --env-file=.env scripts/smoke-shopify.ts   # generates OAuth install URL
```

### Read prod DB
```
npx tsx --env-file=.env scripts/check-prod-db.ts
npx tsx --env-file=.env scripts/check-webhook-debug.ts
```

### Manually insert a Subscription (when webhook is being debugged)
```
npx tsx --env-file=.env scripts/force-subscribe.ts <orgId> STARTER
```

### Deploy
- `git push` to `main` on `sapan-trade/tradeco-pilot`. Vercel auto-deploys.
- For `NEXT_PUBLIC_*` env changes: Vercel → Deployments → ⋯ → Redeploy → **uncheck "Use existing Build Cache"**.

---

## 10. Known Issues

| Issue | Severity | Workaround | Permanent fix |
|---|---|---|---|
| `STRIPE_PRICE_PRO` is duplicated as `STARTER` | Medium | Manually fix the price in Stripe dashboard | Edit env, redeploy |
| `StripeWebhookDebug` table is for debugging only | Low | Leave for now | Drop the model in schema + push when stable |
| In-memory file store doesn't persist across Vercel instances | Low | Fine for MVP / single instance | Wire AWS S3 / R2 |
| Inngest functions exist but aren't actually invoked async | Low | Inline calls work for current scale | Switch to event dispatch when scaling beyond ~10s tasks |
| HTS catalog is 6 entries; Claude handles the rest from training | Low | Works correctly for verified examples | Load real USITC HTS, add retrieval (top-K by embedding) |
| Shopify `embedded: true` in app config | Cosmetic | Doesn't affect OAuth | Toggle to false in Partner dashboard |
| OAuth flow doesn't pass `orgId` through state — relies on session | Low | Works fine for single-org users | Add `orgId` to OAuth state param |

---

## 11. Outstanding Work — PAUSED (resume after UI sprint)

All four hardening tasks deferred per owner. Resume in this order when ready:

- **T17 Secrets rotation** *(highest priority)* — Stripe Secret, Anthropic, Clerk Secret, Neon DB password were all shared in chat. Rotate each:
  - Stripe: https://dashboard.stripe.com/test/apikeys → Roll
  - Anthropic: https://console.anthropic.com/settings/keys → Delete + Create
  - Clerk: https://dashboard.clerk.com → API Keys → Rotate
  - Neon: https://console.neon.tech → Connection Details → Reset password
  - For each: update `.env` locally, update Vercel env (all 3 envs checked), then ONE redeploy at the end.

- **T18 Backup + restore drill** — Confirm Neon free-tier 7-day PITR. Drill: create a branch from 1 hour ago, query, verify data integrity, delete the drill branch. Document the steps in T20 runbook.

- **T19 Monitoring** — Three dashboards, ~10 min total:
  - Sentry: Create Issue Alert → "A new issue is created" → email
  - Vercel: Settings → Notifications → enable Deployment Failed + Domain Errors
  - Stripe: Verify https://dashboard.stripe.com/account/notifications → Failed webhook delivery is ON
  - Optional: add a `/api/health` route that does a `prisma.$queryRaw\`SELECT 1\`` round-trip

- **T20 Runbook** — 1-page Markdown. One section per failure mode with the exact recovery steps. Cover:
  - Stripe webhook delivering 4xx — re-check `STRIPE_WEBHOOK_SECRET`, Snapshot vs Thin payload style, query `StripeWebhookDebug` table
  - Classification stuck PENDING — check `maxDuration`, check Anthropic credit balance, fall back to stub
  - DB connection refused — restore from Neon branch (T18 procedure)
  - AI rate-limited — Anthropic usage dashboard, throttle via in-process token bucket
  - Stripe key invalid after rotation — verify env on Vercel + redeploy
  - User can't sign up — Clerk's allowed origins, publishable key on prod

## 11b. UI Sprint (current focus, 2026-05-31)

Owner: "act as a world class UI expert and a marketing expert; improve the UI of the project, add nice animation and good example why to use this tool."

Deliverables:
- Marketing landing page at `/` with hero, value props, how-it-works, live classification examples, ROI calculator, pricing, CTA.
- Animations via `framer-motion` (fade-ups, staggered card entries, hover lifts, count-up stats).
- Icons via `lucide-react`.
- Improved `globals.css` (proper design tokens, type scale, transitions).
- Improved dashboard home — stats overview cards instead of bullet list.
- Subtle micro-interactions across the dashboard (button transitions, table row hover, loading states).

Goal: a landing page that converts a tariff-frustrated SMB founder into a sign-up in under 60 seconds, and a dashboard that feels modern instead of admin-template.

---

## 12. Critical Design Decisions (for any AI inheriting this)

1. **`NODE_ENV === "test"` forces stub mode in every integration** — `stripe.ts`, `shopify.ts`, `ai.ts`, `ratelimit.ts`, `sentry.ts`. This keeps the test suite free + deterministic. Do not remove these guards.

2. **`getServerCaller()` lazy-upserts** `User`, `Organization`, `Membership` from Clerk session every request. Catches `P2002` (unique constraint) so concurrent first-load requests don't crash. Don't put work that mustn't be retried inside this code path.

3. **The Stripe webhook only writes the Subscription row** when it sees `orgId` in `session.metadata` or `subscription.metadata`. The integration sets both via `subscription_data: { metadata: { orgId, tier } }`. Don't strip that.

4. **Audit hash chain** is per-org. `writeAuditLog()` reads the latest hash for the org, computes `sha256(prevHash | canonical(payload) | timestamp)`. No locks → a concurrent write could create two rows with the same `prevHash`. For low-volume MVP this is fine; if you scale, add row-level locking on the previous AuditLog row.

5. **The deterministic stub classifier** uses FNV-1a hash of `skuId + title + imageUrls` as the seed. Tests rely on this being stable. Don't change the seed input.

6. **Server actions on `/skus`, `/classifications` etc. call the tRPC server caller directly** — there's no client-side tRPC, no react-query. Mutations work via Next.js server actions, lists work via direct server-component fetches. Keep this pattern; it's simpler and works on Hobby plan.

7. **`maxDuration = 60` on the dashboard layout and `/api/trpc/[trpc]/route.ts`** — Hobby plan default is 10s and Claude can take 5-15s. Don't reduce.

8. **Snapshot vs Thin Stripe payload** — the webhook endpoint MUST be configured as Snapshot, not Thin. Our handler reads `event.data.object` directly; Thin format requires a separate API call to fetch the resource. The wrong payload style cost ~2 hours of debugging.

---

## 13. Glossary (trade-specific)

| Term | Meaning |
|---|---|
| HS code | Harmonized System product classification code. 6 digits global, 8-10 country-specific. |
| HTS | Harmonized Tariff Schedule (US version of HS). Maintained by USITC. |
| GRI | General Rules of Interpretation — the legal framework for classifying products. |
| FTA | Free Trade Agreement (USMCA, CPTPP, EU, etc.). |
| CBAM | EU Carbon Border Adjustment Mechanism. Triggers extra reporting for certain imports. |
| Landed cost | Total cost to deliver: product price + duty + VAT + freight + fees. |
| Broker | Licensed customs broker — files declarations, takes legal responsibility. |
| Declaration | The customs filing document. |
| Bps | Basis points; 100 bps = 1%. Used for duty/VAT rates to avoid floating-point. |

---

## 14. Quick Reference: "Where is X?"

| Need | Location |
|---|---|
| Change DB schema | `prisma/schema.prisma`, then `npm run db:migrate` |
| Add new tRPC route | `src/server/trpc/routers/<name>.ts`, register in `_app.ts` |
| Change Claude prompt | `src/lib/ai.ts` → `buildSystemPrompt()` |
| Add Stripe event handler | `src/app/api/webhooks/stripe/route.ts`, add to switch |
| Add UI page | `src/app/(dashboard)/<route>/page.tsx`, append nav link in `(dashboard)/layout.tsx` |
| Add background job | `src/inngest/functions/<name>.ts`, register in `src/app/api/inngest/route.ts`, fire event from service layer |
| Tests for new feature | Add `tests/integration/<name>.spec.ts`; use `createTestContext` and `appRouter.createCaller(ctx)` |
| Mock external service in test | Already handled — `NODE_ENV=test` → stub. Just don't set env vars in tests. |
| Production env var | Vercel → Settings → Environment Variables (must redeploy after change; uncheck cache for NEXT_PUBLIC_*) |

---

## 15. Contact / Ownership

- Repo: `sapan-trade/tradeco-pilot`
- Owner email: killerbeepubg0002@gmail.com
- Vercel project: `tradeco-pilot-h9ys`
- Neon project: `tradeco`
- Stripe account: Sapan's TradeAI sandbox (CAD-denominated)
- Clerk dev instance under Sapan's account
