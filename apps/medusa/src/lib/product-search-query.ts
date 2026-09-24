import { z } from "@medusajs/framework/zod";

const productSearchQueryObject = z.object({
  q: z.string().trim().max(120).default(""),
  category_id: z.string().trim().min(1).max(255).optional(),
  collection_id: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  option: z.union([z.string(), z.array(z.string())]).optional().transform((value) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value],
  ),
  price_min: z.coerce.number().min(0).max(1_000_000_000).optional(),
  price_max: z.coerce.number().min(0).max(1_000_000_000).optional(),
  order: z.enum(["created_at", "title", "-title", "price", "-price"]).optional(),
});

function withProductSearchRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
  (value) => {
    const query = value as z.infer<typeof productSearchQueryObject>;
    return query.q.length === 0 || query.q.length >= 2;
  },
  { message: "Search with at least 2 characters.", path: ["q"] },
).refine(
  (value) => {
    const query = value as z.infer<typeof productSearchQueryObject>;
    return query.price_min === undefined || query.price_max === undefined || query.price_min <= query.price_max;
  },
  { message: "Minimum price cannot exceed maximum price.", path: ["price_min"] },
  );
}

export const productSearchQuerySchema = withProductSearchRefinements(productSearchQueryObject);

export type ProductSearchQueryInput = z.infer<typeof productSearchQuerySchema>;

export const adminProductSearchQuerySchema = withProductSearchRefinements(productSearchQueryObject.extend({
  sales_channel_id: z.string().trim().min(1),
  status: z.enum(["draft", "proposed", "published", "rejected"]).optional(),
}));

export type AdminProductSearchQueryInput = z.infer<typeof adminProductSearchQuerySchema>;
