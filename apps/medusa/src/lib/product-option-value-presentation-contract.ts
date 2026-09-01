import { z } from "@medusajs/framework/zod";

export const PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY =
  "ecs_option_value_presentation" as const;

export const PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY =
  "ecs_product_option_value_presentations" as const;

export const productColorSwatchSchema = z.object({
  kind: z.literal("color"),
  value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const productOptionValuePresentationWriteSchema = z.object({
  optionId: z.string().trim().min(1).optional(),
  optionTitle: z.string().trim().min(1),
  valueId: z.string().trim().min(1).optional(),
  valueLabel: z.string().trim().min(1),
  swatch: productColorSwatchSchema.nullable(),
});

export const productOptionValuePresentationsAdditionalDataSchema = z.object({
  version: z.literal(1),
  values: z.array(productOptionValuePresentationWriteSchema),
});

export type ProductOptionValuePresentationWrite = z.infer<
  typeof productOptionValuePresentationWriteSchema
>;
