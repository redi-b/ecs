import { defineMiddlewares } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";

const colorSwatch = z.object({
  kind: z.literal("color"),
  value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const optionValuePresentations = z.object({
  version: z.literal(1),
  values: z.array(
    z.object({
      optionId: z.string().trim().min(1).optional(),
      optionTitle: z.string().trim().min(1),
      valueId: z.string().trim().min(1).optional(),
      valueLabel: z.string().trim().min(1),
      swatch: colorSwatch.nullable(),
    }),
  ),
});

const additionalDataValidator = {
  ecs_product_option_value_presentations: optionValuePresentations.optional(),
};

export default defineMiddlewares({
  routes: [
    {
      method: "POST",
      matcher: "/admin/products",
      additionalDataValidator,
    },
    {
      method: "POST",
      matcher: "/admin/products/:id",
      additionalDataValidator,
    },
  ],
});
