import { z } from "@medusajs/framework/zod";

export const productSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type ProductSearchQueryInput = z.infer<typeof productSearchQuerySchema>;

export const adminProductSearchQuerySchema = productSearchQuerySchema.extend({
  sales_channel_id: z.string().trim().min(1),
});

export type AdminProductSearchQueryInput = z.infer<typeof adminProductSearchQuerySchema>;
