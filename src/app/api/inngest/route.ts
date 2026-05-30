import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { classifySkuFn } from "@/inngest/functions/classify-sku";
import { ingestRegulatoryFn } from "@/inngest/functions/ingest-regulatory";
import { meterDeclarationsFn } from "@/inngest/functions/meter-declarations";
import { importCsvFn } from "@/inngest/functions/import-csv";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [classifySkuFn, ingestRegulatoryFn, meterDeclarationsFn, importCsvFn],
});
