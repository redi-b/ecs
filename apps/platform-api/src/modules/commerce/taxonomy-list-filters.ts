import { z } from "zod";
export const taxonomyListFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  visibility: z.preprocess(
    (value) => (value === "all" || value === "" ? undefined : value),
    z.enum(["public", "hidden"]).optional(),
  ),
  parentId: z.preprocess(
    (value) => (value === "all" || value === "" ? undefined : value),
    z.string().trim().min(1).max(255).optional(),
  ),
});
