import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runCsvImport, parseCsv } from "@/server/services/csv-importer";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";
import { getObjectStore } from "@/server/integrations/s3";
import { prisma } from "@/lib/db";

let seq = 0;
async function seed() {
  seq++;
  const userId = `u_csv_${Date.now()}_${seq}`;
  const orgId = `org_csv_${Date.now()}_${seq}`;
  await prisma.user.create({ data: { id: userId, email: `${userId}@x.local` } });
  await prisma.organization.create({ data: { id: orgId, name: "CSV Org", country: "US" } });
  await prisma.membership.create({ data: { userId, orgId, role: "OWNER" } });
  return { userId, orgId };
}

describe("csv parser", () => {
  it("handles quoted commas, embedded newlines, escaped quotes", () => {
    const text = 'a,b,c\n"x","y, with comma","line1\nline2"\n"esc ""quote""",1,2\n';
    const rows = parseCsv(text);
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x", "y, with comma", "line1\nline2"],
      ['esc "quote"', "1", "2"],
    ]);
  });
});

describe("csv importer service", () => {
  it("inserts rows from raw CSV, surfaces row errors, marks the job completed", async () => {
    const { userId, orgId } = await seed();
    const csv = readFileSync(path.join(process.cwd(), "tests", "fixtures", "sample-skus.csv"), "utf8");

    const job = await prisma.importJob.create({ data: { orgId, fileToken: "inline" } });
    const result = await runCsvImport({
      orgId,
      userId,
      jobId: job.id,
      source: { csv },
    });

    expect(result.totalRows).toBe(5);
    expect(result.inserted).toBe(4);
    expect(result.failed).toBe(1);
    expect(result.errors.join(" ")).toMatch(/missing title/);

    const skus = await prisma.sku.findMany({ where: { orgId } });
    expect(skus.length).toBe(4);
    const tshirt = skus.find((s) => s.title.startsWith("Men's"));
    expect(tshirt?.supplierCountry).toBe("VN");
    expect(tshirt?.unitValueCents).toBe(1500);
    expect(tshirt?.imageUrls).toEqual(["https://example.com/tshirt.jpg"]);

    const after = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("COMPLETED");
    expect(after.inserted).toBe(4);
    expect(after.failed).toBe(1);
    expect(after.finishedAt).not.toBeNull();
  });

  it("reads from the object store when source is { fileToken }", async () => {
    const { userId, orgId } = await seed();
    const csv = "title,supplier_country\nMug,MX\nShirt,VN\n";
    const { fileToken } = await getObjectStore().presignUpload({ kind: "csv", orgId });
    await getObjectStore().putObject(fileToken, csv);

    const job = await prisma.importJob.create({ data: { orgId, fileToken } });
    const r = await runCsvImport({ orgId, userId, jobId: job.id, source: { fileToken } });
    expect(r.inserted).toBe(2);
    expect(r.failed).toBe(0);
  });

  it("sku.bulkUpload procedure runs the import and returns counts", async () => {
    const { userId, orgId } = await seed();
    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const csv = "title\nMug\nShirt\nLaptop\n";
    const { fileToken } = await getObjectStore().presignUpload({ kind: "csv", orgId });
    await getObjectStore().putObject(fileToken, csv);

    const out = await caller.sku.bulkUpload({ fileToken });
    expect(out.received).toBe(3);
    expect(out.inserted).toBe(3);
    expect(out.failed).toBe(0);

    const status = await caller.sku.importStatus({ jobId: out.jobId });
    expect(status.status).toBe("COMPLETED");
  });

  it("missing required column reports a clear error", async () => {
    const { userId, orgId } = await seed();
    const job = await prisma.importJob.create({ data: { orgId, fileToken: "inline" } });
    const r = await runCsvImport({
      orgId,
      userId,
      jobId: job.id,
      source: { csv: "description,foo\nA,B\n" },
    });
    expect(r.inserted).toBe(0);
    expect(r.errors[0]).toMatch(/missing required column: title/);
  });
});
