import { inngest } from "../client";
import { runClassification } from "@/server/services/classifier";

/**
 * Wired but not yet invoked from the tRPC procedure in Phase 1
 * (the procedure calls runClassification inline for testability).
 * Phase 2 switches `classification.run` to `inngest.send({ name: "classification/run", ... })`.
 */
export const classifySkuFn = inngest.createFunction(
  { id: "classify-sku" },
  { event: "classification/run" },
  async ({ event }) => {
    const { classificationId } = event.data as { classificationId: string };
    await runClassification(classificationId);
    return { classificationId };
  }
);
