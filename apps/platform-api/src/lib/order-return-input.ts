import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(500).optional(),
);

const orderReturnInputSchema = z.object({
  items: z
    .array(
      z.object({
        lineItemId: z.string().trim().min(1),
        quantity: z.number().int().positive(),
        reasonId: optionalText,
        note: optionalText,
      }),
    )
    .min(1),
  note: optionalText,
});

export function parseOrderReturnInput(value: unknown) {
  const parsed = orderReturnInputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
