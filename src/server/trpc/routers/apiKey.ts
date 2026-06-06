import { z } from "zod";
import { router, requireRole } from "../init";
import { createApiKey, listApiKeys, revokeApiKey } from "@/server/services/api-keys";

export const apiKeyRouter = router({
  list: requireRole("OWNER").query(({ ctx }) => listApiKeys(ctx.org.id)),

  create: requireRole("OWNER")
    .input(z.object({ name: z.string().trim().min(1).max(60) }))
    .mutation(({ ctx, input }) => createApiKey(ctx.org.id, input.name)),

  revoke: requireRole("OWNER")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await revokeApiKey(ctx.org.id, input.id);
      return { ok: true as const };
    }),
});
