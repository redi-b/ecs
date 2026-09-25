import { z } from "zod";

export const merchantOrderPaymentMethodSchema = z.enum(["cod", "chapa", "unknown"]);

export type MerchantOrderPaymentMethod = z.infer<typeof merchantOrderPaymentMethodSchema>;

/** How money was received (mark-paid / Chapa auto). Distinct from checkout rail. */
export const merchantOrderSettlementMethodSchema = z.enum([
  "cash",
  "telebirr",
  "cbe_birr",
  "bank_transfer",
  "chapa",
  "other",
]);

export type MerchantOrderSettlementMethod = z.infer<typeof merchantOrderSettlementMethodSchema>;

export const merchantOrderSettlementSchema = z.object({
  method: merchantOrderSettlementMethodSchema,
  bankCode: z.string().min(1).nullable().optional(),
  bankName: z.string().min(1).nullable().optional(),
  accountLast4: z.string().min(1).nullable().optional(),
  accountLabel: z.string().min(1).nullable().optional(),
  receivingAccountId: z.string().min(1).nullable().optional(),
  reference: z.string().min(1).nullable().optional(),
  note: z.string().min(1).nullable().optional(),
  recordedAt: z.string().min(1).nullable().optional(),
});

export type MerchantOrderSettlement = z.infer<typeof merchantOrderSettlementSchema>;

export const merchantOrderRefundReasonSchema = z.enum([
  "customer_request",
  "item_unavailable",
  "wrong_item",
  "damaged_item",
  "duplicate_payment",
  "other",
]);

export type MerchantOrderRefundReason = z.infer<typeof merchantOrderRefundReasonSchema>;

export const merchantOrderRefundSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  method: merchantOrderSettlementMethodSchema.nullable(),
  reason: merchantOrderRefundReasonSchema.nullable(),
  reference: z.string().min(1).nullable(),
  note: z.string().min(1).nullable(),
  createdAt: z.string().min(1).nullable(),
});

export type MerchantOrderRefund = z.infer<typeof merchantOrderRefundSchema>;

/** Tenant-safe public reference; never expose Medusa's shared global display_id. */
export function formatPublicOrderReference(
  orderId: string,
  customDisplayId?: string | null,
): string {
  const custom = customDisplayId?.trim();
  if (custom) return custom;
  const suffix = orderId
    .replace(/^order_/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-10)
    .toUpperCase();
  return suffix ? `ORD-${suffix}` : "Order";
}

export const merchantReceivingAccountSchema = z.object({
  id: z.string().min(1),
  bankCode: z.string().min(1).nullable(),
  bankName: z.string().min(1),
  accountName: z.string().min(1).nullable(),
  accountLast4: z.string().min(1).nullable(),
  label: z.string().min(1),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type MerchantReceivingAccount = z.infer<typeof merchantReceivingAccountSchema>;

export const merchantOrderSchema = z.object({
  id: z.string().min(1),
  displayId: z.number().int().nullable(),
  customDisplayId: z.string().min(1).nullable().optional(),
  email: z.string().min(1).nullable(),
  customerId: z.string().min(1).nullable().optional(),
  status: z.string().min(1).nullable(),
  paymentStatus: z.string().min(1).nullable(),
  fulfillmentStatus: z.string().min(1).nullable(),
  paymentMethod: merchantOrderPaymentMethodSchema.nullable().optional(),
  paymentReference: z.string().min(1).nullable().optional(),
  settlement: merchantOrderSettlementSchema.nullable().optional(),
  note: z.string().min(1).nullable().optional(),
  adjustmentReason: z.string().min(1).nullable().optional(),
  currencyCode: z.string().min(1).nullable(),
  total: z.number().nullable(),
  refundedTotal: z.number().nonnegative().optional(),
  refundableTotal: z.number().nonnegative().optional(),
  refunds: z.array(merchantOrderRefundSchema).optional(),
  subtotal: z.number().nullable().optional(),
  shippingTotal: z.number().nullable().optional(),
  discountTotal: z.number().nullable().optional(),
  itemCount: z.number().int().nonnegative().nullable().optional(),
  delivery: z
    .object({
      choice: z.string().min(1).nullable(),
      customerName: z.string().min(1).nullable(),
      customerPhone: z.string().min(1).nullable(),
      landmark: z.string().min(1).nullable(),
      notes: z.string().min(1).nullable(),
    })
    .optional(),
  fulfillments: z
    .array(
      z.object({
        id: z.string().min(1),
        deliveredAt: z.string().min(1).nullable(),
        shippedAt: z.string().min(1).nullable(),
        canceledAt: z.string().min(1).nullable(),
      }),
    )
    .optional(),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        productId: z.string().min(1).nullable().optional(),
        variantId: z.string().min(1).nullable().optional(),
        title: z.string().min(1).nullable(),
        /** Product name when Medusa separates product vs variant line title. */
        productTitle: z.string().min(1).nullable().optional(),
        /** Variant label / options summary (e.g. "Large / Red"). */
        variantTitle: z.string().min(1).nullable().optional(),
        quantity: z.number().nullable(),
        fulfilledQuantity: z.number().nullable().optional(),
        unitPrice: z.number().nullable(),
        total: z.number().nullable(),
        thumbnail: z.string().min(1).nullable(),
      }),
    )
    .optional(),
  shippingAddress: z
    .object({
      firstName: z.string().min(1).nullable(),
      lastName: z.string().min(1).nullable(),
      phone: z.string().min(1).nullable(),
      address1: z.string().min(1).nullable(),
      address2: z.string().min(1).nullable(),
      city: z.string().min(1).nullable(),
      province: z.string().min(1).nullable(),
      postalCode: z.string().min(1).nullable(),
      countryCode: z.string().min(1).nullable(),
    })
    .optional(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
});

export const merchantOrdersSchema = z.object({
  orders: z.array(merchantOrderSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type MerchantOrder = z.infer<typeof merchantOrderSchema>;

export type MerchantOrders = z.infer<typeof merchantOrdersSchema>;
