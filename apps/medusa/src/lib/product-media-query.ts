import { z } from "@medusajs/framework/zod";
import { AdminGetProductsParams } from "@medusajs/medusa/api/admin/products/validators";

export const productMediaQuerySchema = AdminGetProductsParams.and(
  z.object({
    media: z.enum(["with_media", "without_media"]).optional(),
    category_missing: z.literal("true").optional(),
    collection_missing: z.literal("true").optional(),
    sales_channel_id: z.array(z.string().trim().min(1)).length(1),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).optional(),
  }),
);

export function productMediaFilters(media: "with_media" | "without_media") {
  return media === "with_media"
    ? {
        $or: [
          { $and: [{ thumbnail: { $ne: null } }, { thumbnail: { $ne: "" } }] },
          { images: { id: { $ne: null } } },
        ],
      }
    : { $and: [{ $or: [{ thumbnail: null }, { thumbnail: "" }] }, { images: { id: null } }] };
}
