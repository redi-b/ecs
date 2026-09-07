import { z } from "zod";

export const productListFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.preprocess(
    (value) => (value === "all" || value === "" ? undefined : value),
    z.enum(["published", "draft", "unknown", "proposed", "rejected"]).optional(),
  ),
  media: z.preprocess(
    (value) => (value === "all" || value === "" ? undefined : value),
    z.enum(["with_media", "without_media"]).optional(),
  ),
  categoryId: z.preprocess(
    (value) => (value === "all" || value === "" ? undefined : value),
    z.string().trim().min(1).max(255).optional(),
  ),
  collectionId: z.preprocess(
    (value) => (value === "all" || value === "" ? undefined : value),
    z.string().trim().min(1).max(255).optional(),
  ),
});
export type ProductListFilters = z.output<typeof productListFiltersSchema>;
