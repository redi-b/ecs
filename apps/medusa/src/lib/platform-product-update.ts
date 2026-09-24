import { z } from "@medusajs/framework/zod";

const optionMutationSchema = z.object({
  add: z
    .array(
      z.union([
        z.string(),
        z.object({ title: z.string(), values: z.array(z.string()) }),
      ]),
    )
    .optional(),
  remove: z.array(z.string()).optional(),
  update: z
    .array(
      z.object({
        product_option_id: z.string(),
        add: z.array(z.object({ value: z.string() })).optional(),
        remove: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export const platformProductUpdateSchema = z.object({
  before_options: optionMutationSchema.optional(),
  update: z.record(z.string(), z.unknown()),
  after_options: optionMutationSchema.optional(),
});

export type PlatformProductUpdateInput = z.infer<typeof platformProductUpdateSchema>;
