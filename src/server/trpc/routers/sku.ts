import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../init";
import { writeAuditLog } from "@/server/services/audit";
import { runCsvImport } from "@/server/services/csv-importer";
import type { Sku } from "@prisma/client";

const SkuInput = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  materials: z.array(z.object({ material: z.string(), pct: z.number() })).nullish(),
  imageUrls: z.array(z.string().url()).default([]),
  supplierCountry: z.string().length(2).nullish(),
  unitValueCents: z.number().int().nonnegative().nullish(),
  currency: z.string().length(3).default("USD"),
});

function toDto(sku: Sku) {
  return {
    id: sku.id,
    title: sku.title,
    description: sku.description,
    materials: sku.materials ?? null,
    imageUrls: sku.imageUrls,
    supplierCountry: sku.supplierCountry,
    unitValueCents: sku.unitValueCents,
    currency: sku.currency,
    source: sku.source,
    externalId: sku.externalId,
    createdAt: sku.createdAt.toISOString(),
  };
}

export const skuRouter = router({
  create: orgProcedure.input(SkuInput).mutation(async ({ ctx, input }) => {
    const sku = await ctx.prisma.sku.create({
      data: {
        orgId: ctx.org.id,
        title: input.title,
        description: input.description ?? null,
        materials: (input.materials ?? undefined) as object | undefined,
        imageUrls: input.imageUrls,
        supplierCountry: input.supplierCountry ?? null,
        unitValueCents: input.unitValueCents ?? null,
        currency: input.currency,
      },
    });
    await writeAuditLog({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: "sku.create",
      subject: `sku:${sku.id}`,
      payload: { id: sku.id, title: sku.title },
    });
    return toDto(sku);
  }),

  list: orgProcedure
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(100).default(50),
          q: z.string().nullish(),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.sku.findMany({
        where: {
          orgId: ctx.org.id,
          ...(input.q ? { title: { contains: input.q, mode: "insensitive" } } : {}),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });
      const nextCursor = items.length > input.limit ? items.pop()!.id : null;
      return { items: items.map(toDto), nextCursor };
    }),

  get: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const sku = await ctx.prisma.sku.findFirst({
      where: { id: input.id, orgId: ctx.org.id },
      include: { classifications: { orderBy: { createdAt: "desc" } } },
    });
    if (!sku) throw new TRPCError({ code: "NOT_FOUND" });
    const { classifications, ...rest } = sku;
    return { ...toDto(rest), classifications };
  }),

  update: orgProcedure
    .input(z.object({ id: z.string(), patch: SkuInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.sku.findFirst({
        where: { id: input.id, orgId: ctx.org.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.prisma.sku.update({
        where: { id: input.id },
        data: {
          ...input.patch,
          materials: (input.patch.materials ?? undefined) as object | undefined,
        },
      });
      return toDto(updated);
    }),

  delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.sku.findFirst({
      where: { id: input.id, orgId: ctx.org.id },
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
    await ctx.prisma.sku.delete({ where: { id: input.id } });
    return { ok: true as const };
  }),

  bulkUpload: orgProcedure
    .input(z.object({ fileToken: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.importJob.create({
        data: { orgId: ctx.org.id, fileToken: input.fileToken },
      });
      // Phase 4: run inline so the procedure returns terminal counts. Production
      // dispatches `sku/csv.import` to Inngest for durability; the function file
      // already exists at src/inngest/functions/import-csv.ts.
      const result = await runCsvImport({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        jobId: job.id,
        source: { fileToken: input.fileToken },
      });
      return {
        jobId: result.jobId,
        received: result.totalRows,
        inserted: result.inserted,
        failed: result.failed,
      };
    }),

  importStatus: orgProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.importJob.findFirst({
        where: { id: input.jobId, orgId: ctx.org.id },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        id: job.id,
        status: job.status,
        totalRows: job.totalRows,
        inserted: job.inserted,
        failed: job.failed,
        errors: job.errors ?? null,
        startedAt: job.startedAt ? job.startedAt.toISOString() : null,
        finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
      };
    }),
});
