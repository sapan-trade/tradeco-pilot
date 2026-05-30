import { inngest } from "../client";
import { runCsvImport } from "@/server/services/csv-importer";

export const importCsvFn = inngest.createFunction(
  { id: "import-csv" },
  { event: "sku/csv.import" },
  async ({ event }) => {
    const { orgId, userId, jobId, fileToken } = event.data as {
      orgId: string;
      userId: string;
      jobId: string;
      fileToken: string;
    };
    return runCsvImport({ orgId, userId, jobId, source: { fileToken } });
  }
);
