import { router } from "../init";
import { orgRouter } from "./org";
import { skuRouter } from "./sku";
import { classificationRouter } from "./classification";
import { brokerRouter } from "./broker";
import { declarationRouter } from "./declaration";
import { landedCostRouter } from "./landedCost";
import { regulatoryRouter } from "./regulatory";
import { auditRouter } from "./audit";
import { billingRouter } from "./billing";
import { brokerPortalRouter } from "./brokerPortal";
import { marketplaceRouter } from "./marketplace";
import { adminBrokersRouter } from "./adminBrokers";

export const appRouter = router({
  org: orgRouter,
  sku: skuRouter,
  classification: classificationRouter,
  broker: brokerRouter,
  declaration: declarationRouter,
  landedCost: landedCostRouter,
  regulatory: regulatoryRouter,
  audit: auditRouter,
  billing: billingRouter,
  brokerPortal: brokerPortalRouter,
  marketplace: marketplaceRouter,
  adminBrokers: adminBrokersRouter,
});

export type AppRouter = typeof appRouter;
