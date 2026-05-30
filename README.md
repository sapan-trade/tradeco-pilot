# TradeCo-Pilot — Phase 4

Adds: Shopify connector (OAuth + product sync + webhook), CSV bulk-upload, image inputs into the classifier, presigned upload URLs (in-memory store with S3 swap-in), in-memory rate limiter (Upstash swap-in), Sentry seam, and three new dashboard pages (Connectors, Regulatory, Audit log).

All earlier phase features still pass — see "What's in earlier phases" below.

## Prerequisites
- Node.js 20+
- Docker (for local Postgres)

## Setup

```
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm test
```

`npm test` is the acceptance gate. It must exit 0. The Phase 4 vitest suite runs `classify`, `broker`, `declaration`, `regulatory`, `billing`, `csv-import`, and `shopify` specs.

Phase 4 schema changes — re-run `npm run db:migrate`:
- New `Connector` model (one row per (org, integration type)) storing Shopify access tokens.
- New `ImportJob` model tracking async CSV imports.

### Running the UI

```
npm run dev
# visit http://localhost:3000
# auth in dev: send headers `x-test-user` and `x-test-org` (matching seeded rows)
```

### Running the Playwright e2e

```
npx playwright install chromium
npm run test:e2e
```

Playwright auto-starts `npm run dev` against the local DB. The test seeds an org + owner + broker, walks through the SKU → classify → broker-approve flow, and verifies the Stripe checkout redirect target.

## What runs

- `docker compose up` starts Postgres on `localhost:5432`.
- `npm run db:migrate` uses `prisma db push` to materialize the schema. Proper migration files land in a later phase.
- `npm run db:seed` is a no-op in Phase 1 (HS reference data lives in `prisma/seed/hts.json` and is loaded by the integration stub on demand). It exists so the script contract is stable from day one.
- `npm test` runs the Vitest integration suite against the live Postgres.

## What's stubbed (interface boundaries)

Every external system is behind an interface that logs `TODO: replace with real client` and returns synthetic data. Replace later without touching domain code.

- `src/lib/ai.ts` — deterministic keyword-based classifier seeded by SKU id hash.
- `src/server/integrations/hts.ts` — reads `prisma/seed/hts.json`.
- `src/server/integrations/{shopify,netsuite,shipstation,broker-notifier}.ts` — no-op stubs.
- `src/server/integrations/federal-register.ts` — **real** HTTP client; tests inject a fixture.
- `src/server/integrations/stripe.ts` — **dual-mode**: real `Stripe` SDK when `STRIPE_SECRET_KEY` is set, otherwise a deterministic stub that returns `https://stub.local/...` URLs and a TODO log. Webhook handler at `/api/webhooks/stripe` uses the same client for signature verification, so the stub parses payloads unverified in dev/test.
- Inngest functions live under `src/inngest/functions/` and are mounted at `/api/inngest`. tRPC procedures still invoke services inline for testability; the Inngest functions are wired and ready for production durability.

## Phase 3 additions

- **Server-rendered dashboard**: `/dashboard`, `/skus`, `/skus/[id]`, `/classifications`, `/declarations`, `/settings/billing`. All pages are RSC; mutations use Next.js server actions that call the tRPC server caller.
- **Broker UI**: `/queue` and `/case/[id]`. Approve / correct / reject buttons hit `broker.decide`.
- **Billing router**: `billing.subscription`, `billing.checkout` (OWNER), `billing.portal` (OWNER, requires existing subscription).
- **Stripe webhook handler**: `/api/webhooks/stripe` handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` — upserts `Subscription` rows.
- **Auth seam at `src/lib/server-caller.ts`**: reads `x-test-user` / `x-test-org` headers today. Swap to `auth()` from `@clerk/nextjs/server` when keys land — no domain code changes.
- **Playwright e2e**: `tests/e2e/happy-path.spec.ts` exercises owner-creates-SKU → classify → broker-approves → billing-checkout-redirect.

## Phase 4 additions

- **Shopify connector** (`src/server/integrations/shopify.ts`): real Admin API client when `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET` are set, otherwise a deterministic stub that returns three synthetic products. HMAC webhook verification when keys are real; stub accepts everything.
  - `GET /api/connectors/shopify/start?shop=<store>.myshopify.com` — initiates install, persists a `Connector` row with state token.
  - `GET /api/connectors/shopify/callback` — verifies state, exchanges code, runs `syncShopifyProductsToSkus`, writes audit row, redirects to `/connectors`.
  - `POST /api/connectors/shopify/webhook` — verifies HMAC, upserts/deletes SKUs for `products/create|update|delete`.
- **CSV bulk-upload**: `runCsvImport` service + `sku.bulkUpload` tRPC mutation + `sku.importStatus` query. Inngest function `import-csv` at `src/inngest/functions/import-csv.ts` is wired but the tRPC procedure invokes the service inline for testability.
- **Image inputs in the classifier**: `imageUrls` flow from SKU into `generateHsCode`. The stub folds them into both the hash seed and a small confidence bonus; the rationale string mentions image contribution. Real Anthropic vision client wires in behind the same `generateHsCode` signature when `USE_REAL_AI=1`.
- **Object storage** (`src/server/integrations/s3.ts`): in-memory store by default; swaps to S3 when `AWS_S3_BUCKET` is set. Presign endpoint `POST /api/connectors/upload/presign`; the paired `PUT /api/connectors/upload/put` accepts the actual bytes for the in-memory store.
- **Rate limiter** (`src/server/integrations/ratelimit.ts`): in-memory token bucket per process; swaps to Upstash when `UPSTASH_REDIS_REST_URL` / `_TOKEN` are set. Currently applied to the upload-presign endpoint.
- **Error tracking seam** (`src/server/integrations/sentry.ts`): `captureException` no-ops to `console.error` until `SENTRY_DSN` + `@sentry/nextjs` are wired.
- **New UI**: `/connectors`, `/regulatory`, `/audit`.

## Phase 2 additions

- **Broker workflow**: low-confidence (`confidence < org.settings.confidenceThreshold`, default 0.85) classifications automatically spawn a `BrokerReview` row with `brokerUserId = null`. A user with role `BROKER` can call `broker.queue`, `broker.get`, and `broker.decide` to approve / correct / reject. Decisions transition the classification to `BROKER_APPROVED` or `BROKER_REJECTED` and write an audit-chain entry.
- **Declarations**: `declaration.create` snapshots the classification + latest landed-cost estimate into `packageJson` and starts in `DRAFT`. `declaration.submit` transitions to `SUBMITTED`, audits the change, and meters a unit through the Stripe stub.
- **Landed cost**: `landedCost.estimate` computes duty (from HTS), destination VAT, freight, and fees, and writes a `LandedCostEstimate` snapshot.
- **Regulatory ingest**: `ingestRegulatoryUpdates(fetcher?)` is testable directly; the Inngest cron `0 6 * * *` runs it daily in prod. Upserts by `(source, externalId)`, so re-runs are idempotent.
- **Audit list**: `audit.list` (role: OWNER or ADMIN) returns ordered audit rows with hash chain.

## Layout

- `prisma/schema.prisma` — adds `Connector` and `ImportJob` in Phase 4.
- `src/server/trpc/routers/` — `org`, `sku` (now with `bulkUpload`/`importStatus`), `classification`, `broker`, `declaration`, `landedCost`, `regulatory`, `audit`, `billing`.
- `src/server/services/` — `classifier`, `audit`, `rules-engine`, `landed-cost`, `declaration`, `csv-importer`.
- `src/server/integrations/` — `hts`, `federal-register`, `stripe`, `shopify`, `netsuite`, `shipstation`, `broker-notifier`, `s3`, `ratelimit`, `sentry`.
- `src/inngest/functions/` — `classify-sku`, `ingest-regulatory`, `meter-declarations`, `import-csv`.
- `src/app/(dashboard)/` — tenant UI (SKUs, classifications, declarations, billing, connectors, regulatory, audit).
- `src/app/(broker)/` — broker UI (queue, case).
- `src/app/api/` — tRPC, Clerk webhook, Stripe webhook, Inngest serve, Shopify start/callback/webhook, upload presign + put.
- `src/components/` — `StatusPill`, `ConfidenceBadge`.
- `src/lib/server-caller.ts` — auth seam for server components.
- `tests/integration/` — `classify`, `broker`, `declaration`, `regulatory`, `billing`, `csv-import`, `shopify`.
- `tests/e2e/happy-path.spec.ts` — Playwright e2e.
- `tests/fixtures/sample-skus.csv` — CSV importer fixture.

## What's in earlier phases

- **Phase 1**: backend foundation, create-SKU-and-classify flow, append-only audit chain, deterministic stub classifier, multi-tenant org isolation, Clerk-webhook user/org mirroring.
- **Phase 2**: broker review queue + decisions, declaration lifecycle, landed-cost engine, regulatory feed ingest, audit list endpoint.
- **Phase 3**: server-rendered dashboard + broker UI, billing router, Stripe webhook (real SDK with stub fallback), Playwright e2e.
