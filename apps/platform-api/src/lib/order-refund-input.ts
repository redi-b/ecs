import {
  merchantOrderRefundReasonSchema,
  merchantOrderSettlementMethodSchema,
} from "@ecs/contracts";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(500).optional(),
);

const orderRefundInputSchema = z.object({
  amount: z.number().finite().positive(),
  method: merchantOrderSettlementMethodSchema,
  reason: merchantOrderRefundReasonSchema,
  reference: optionalText,
  note: optionalText,
});

export function parseOrderRefundInput(value: unknown) {
  const parsed = orderRefundInputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
