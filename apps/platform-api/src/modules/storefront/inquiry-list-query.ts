import { z } from "zod";

export const inquiryListFiltersSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(["new", "read", "resolved", "archived"]).optional(),
    type: z.enum(["contact", "product_request"]).optional(),
    createdFrom: z.string().datetime({ offset: true }).optional(),
    createdTo: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (value) =>
      !value.createdFrom ||
      !value.createdTo ||
      Date.parse(value.createdFrom) <= Date.parse(value.createdTo),
    {
      message: "Date range is reversed",
    },
  );
