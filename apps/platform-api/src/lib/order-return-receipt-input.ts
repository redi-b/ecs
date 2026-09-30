import { z } from "zod";

const orderReturnReceiptInputSchema = z.object({
  items: z
    .array(
      z
        .object({
          lineItemId: z.string().trim().min(1),
          sellableQuantity: z.number().int().nonnegative(),
          damagedQuantity: z.number().int().nonnegative(),
        })
        .refine((item) => item.sellableQuantity + item.damagedQuantity > 0),
    )
    .min(1),
});

export function parseOrderReturnReceiptInput(value: unknown) {
  const parsed = orderReturnReceiptInputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
