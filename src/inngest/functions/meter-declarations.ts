import { inngest } from "../client";
import { recordDeclarationUsage } from "@/server/services/declaration";

/**
 * Wired but not yet invoked from `declaration.submit` in Phase 2
 * (the service calls recordDeclarationUsage inline for testability).
 * Phase 3 will switch submit to `inngest.send({ name: "declaration/submitted", ... })`.
 */
export const meterDeclarationsFn = inngest.createFunction(
  { id: "meter-declarations" },
  { event: "declaration/submitted" },
  async ({ event }) => {
    const { declarationId } = event.data as { declarationId: string };
    await recordDeclarationUsage(declarationId);
    return { declarationId };
  }
);
