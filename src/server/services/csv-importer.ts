import { prisma } from "@/lib/db";
import { writeAuditLog } from "./audit";
import { getObjectStore } from "@/server/integrations/s3";

const REQUIRED_HEADER = ["title"];

export interface CsvImportResult {
  jobId: string;
  totalRows: number;
  inserted: number;
  failed: number;
  errors: string[];
}

export async function runCsvImport(args: {
  orgId: string;
  userId: string;
  jobId: string;
  source: { csv: string } | { fileToken: string };
}): Promise<CsvImportResult> {
  let csvText: string;
  if ("csv" in args.source) {
    csvText = args.source.csv;
  } else {
    const obj = await getObjectStore().getObject(args.source.fileToken);
    if (!obj) throw new Error(`Object not found for token ${args.source.fileToken}`);
    csvText = obj.toString("utf8");
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    await finishJob(args.jobId, { totalRows: 0, inserted: 0, failed: 0, errors: ["empty csv"] });
    return { jobId: args.jobId, totalRows: 0, inserted: 0, failed: 0, errors: ["empty csv"] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  for (const req of REQUIRED_HEADER) {
    if (!header.includes(req)) {
      const errors = [`missing required column: ${req}`];
      await finishJob(args.jobId, { totalRows: 0, inserted: 0, failed: 0, errors });
      return { jobId: args.jobId, totalRows: 0, inserted: 0, failed: 0, errors };
    }
  }

  const colIdx = (name: string) => header.indexOf(name);
  const iTitle = colIdx("title");
  const iDesc = colIdx("description");
  const iSupplier = colIdx("supplier_country");
  const iUnitValue = colIdx("unit_value_cents");
  const iImage = colIdx("image_url");

  const data = rows.slice(1);
  await prisma.importJob.update({
    where: { id: args.jobId },
    data: { status: "PROCESSING", totalRows: data.length, startedAt: new Date() },
  });

  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const title = (row[iTitle] ?? "").trim();
    if (!title) {
      failed++;
      errors.push(`row ${r + 2}: missing title`);
      continue;
    }
    try {
      await prisma.sku.create({
        data: {
          orgId: args.orgId,
          title,
          description: iDesc >= 0 ? (row[iDesc] ?? "").trim() || null : null,
          supplierCountry:
            iSupplier >= 0 && row[iSupplier] && row[iSupplier].trim().length === 2
              ? row[iSupplier].trim().toUpperCase()
              : null,
          unitValueCents:
            iUnitValue >= 0 && row[iUnitValue] && /^\d+$/.test(row[iUnitValue].trim())
              ? Number(row[iUnitValue].trim())
              : null,
          imageUrls: iImage >= 0 && row[iImage] ? [row[iImage].trim()] : [],
          source: "csv",
          currency: "USD",
        },
      });
      inserted++;
    } catch (e: any) {
      failed++;
      errors.push(`row ${r + 2}: ${e.message ?? "unknown"}`);
    }
  }

  await finishJob(args.jobId, { totalRows: data.length, inserted, failed, errors });
  await writeAuditLog({
    orgId: args.orgId,
    userId: args.userId,
    action: "csv.import",
    subject: `import:${args.jobId}`,
    payload: { totalRows: data.length, inserted, failed },
  });

  return { jobId: args.jobId, totalRows: data.length, inserted, failed, errors };
}

async function finishJob(
  jobId: string,
  data: { totalRows: number; inserted: number; failed: number; errors: string[] }
) {
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: data.failed > 0 && data.inserted === 0 ? "FAILED" : "COMPLETED",
      totalRows: data.totalRows,
      inserted: data.inserted,
      failed: data.failed,
      errors: data.errors.length ? data.errors : undefined,
      finishedAt: new Date(),
    },
  });
}

/**
 * Minimal RFC 4180-ish CSV parser. Handles quoted fields with embedded commas / newlines
 * and `""` escapes. Sufficient for SMB SKU exports; not a general CSV implementation.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => {
    if (row.length > 0 && !(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") pushField();
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { pushField(); pushRow(); }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }
  return rows;
}
