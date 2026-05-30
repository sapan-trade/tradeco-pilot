import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES = [
  "AuditLog","LandedCostEstimate","BrokerReview","Declaration","Classification",
  "Sku","Subscription","Membership","RegulatoryUpdate","Organization","User",
];

test.beforeAll(async () => {
  const quoted = TABLES.map((t) => `"${t}"`).join(",");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  await prisma.user.create({ data: { id: "u_e2e_owner", email: "owner@e2e.test" } });
  await prisma.user.create({ data: { id: "u_e2e_broker", email: "broker@e2e.test" } });
  await prisma.organization.create({
    data: { id: "org_e2e", name: "E2E Org", country: "US", settings: { confidenceThreshold: 0.999 } },
  });
  await prisma.membership.create({ data: { userId: "u_e2e_owner", orgId: "org_e2e", role: "OWNER" } });
  await prisma.membership.create({ data: { userId: "u_e2e_broker", orgId: "org_e2e", role: "BROKER" } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("owner adds SKU + classifies + broker approves it", async ({ browser }) => {
  const ownerCtx = await browser.newContext({
    extraHTTPHeaders: { "x-test-user": "u_e2e_owner", "x-test-org": "org_e2e" },
  });
  const ownerPage = await ownerCtx.newPage();

  await ownerPage.goto("/skus");
  await ownerPage.fill('input[name="title"]', "Men's cotton T-shirt");
  await ownerPage.fill('textarea[name="description"]', "100% cotton knit");
  await ownerPage.fill('input[name="supplierCountry"]', "VN");
  await ownerPage.click('form[data-testid="create-sku"] button[type="submit"]');
  await expect(ownerPage.locator("text=Men's cotton T-shirt")).toBeVisible();

  await ownerPage
    .locator("tr", { hasText: "Men's cotton T-shirt" })
    .locator('button[name="classify"]')
    .click();

  await ownerPage.goto("/classifications");
  await expect(ownerPage.locator("text=NEEDS_REVIEW")).toBeVisible({ timeout: 15_000 });

  const brokerCtx = await browser.newContext({
    extraHTTPHeaders: { "x-test-user": "u_e2e_broker", "x-test-org": "org_e2e" },
  });
  const brokerPage = await brokerCtx.newPage();
  await brokerPage.goto("/queue");
  await expect(brokerPage.locator("text=Men's cotton T-shirt")).toBeVisible();
  await brokerPage.click("text=Open");
  await brokerPage.click('button[name="decision"][value="APPROVED"]');

  await ownerPage.goto("/classifications");
  await expect(ownerPage.locator("text=BROKER_APPROVED")).toBeVisible();
});

test("billing checkout redirects to Stripe (stub) URL", async ({ browser }) => {
  const ownerCtx = await browser.newContext({
    extraHTTPHeaders: { "x-test-user": "u_e2e_owner", "x-test-org": "org_e2e" },
  });
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto("/settings/billing");
  // Intercept the stub destination so the test doesn't navigate to a real URL.
  await ownerPage.route("https://stub.local/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: "stub" })
  );
  await ownerPage
    .locator("form", { has: ownerPage.locator("input[value='STARTER']") })
    .locator("button[type=submit]")
    .click();
  await ownerPage.waitForURL(/stub\.local\/checkout/);
  expect(ownerPage.url()).toContain("tier=STARTER");
});
