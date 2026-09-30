import { z } from "zod";

export const merchantSaleDraftAddressSchema = z.object({
  address1: z.string().trim().max(240).nullable().optional(),
  address2: z.string().trim().max(240).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  countryCode: z.string().trim().length(2).nullable().optional(),
  firstName: z.string().trim().max(120).nullable().optional(),
  lastName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  postalCode: z.string().trim().max(40).nullable().optional(),
  province: z.string().trim().max(120).nullable().optional(),
});

export const merchantSaleDraftContentSchema = z.object({
  adjustmentReason: z.string().trim().max(240).nullable().optional(),
  currencyCode: z.literal("etb").default("etb"),
  currentStep: z.number().int().min(0).max(2),
  customer: z.object({
    email: z.string().trim().email().max(320).nullable().optional(),
    firstName: z.string().trim().max(120).nullable().optional(),
    id: z.string().trim().min(1).max(120).nullable().optional(),
    lastName: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
  }),
  discount: z
    .object({
      type: z.enum(["fixed", "percentage"]),
      value: z.number().positive().finite().max(100_000_000),
    })
    .nullable()
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(120),
        productTitle: z.string().trim().min(1).max(240).nullable().optional(),
        quantity: z.number().int().positive().max(1_000_000),
        sku: z.string().trim().min(1).max(120).nullable().optional(),
        unitPrice: z.number().nonnegative().finite().max(100_000_000).nullable().optional(),
        variantId: z.string().trim().min(1).max(120),
        variantTitle: z.string().trim().min(1).max(240).nullable().optional(),
      }),
    )
    .max(100),
  note: z.string().trim().max(2_000).nullable().optional(),
  shippingAddress: merchantSaleDraftAddressSchema.nullable().optional(),
  shippingOptionId: z.string().trim().min(1).max(120).nullable().optional(),
});

export type MerchantSaleDraftContent = z.infer<typeof merchantSaleDraftContentSchema>;

export const merchantSaleDraftConflictSchema = z.object({
  availableQuantity: z.number().nullable().optional(),
  code: z.enum(["product_removed", "variant_removed", "price_changed", "insufficient_stock"]),
  currentPrice: z.number().nullable().optional(),
  productId: z.string().min(1),
  variantId: z.string().min(1),
});

export type MerchantSaleDraftConflict = z.infer<typeof merchantSaleDraftConflictSchema>;

export type MerchantSaleDraft = MerchantSaleDraftContent & {
  conflicts: MerchantSaleDraftConflict[];
  createdAt: string;
  id: string;
  ownerUserId: string;
  revision: number;
  updatedAt: string;
};

export const merchantSaleDraftSchema = merchantSaleDraftContentSchema.extend({
  conflicts: z.array(merchantSaleDraftConflictSchema),
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  ownerUserId: z.string().min(1),
  revision: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

export type MerchantSaleDraftSummary = Pick<
  MerchantSaleDraft,
  "createdAt" | "currentStep" | "id" | "ownerUserId" | "revision" | "updatedAt"
> & {
  customerLabel: string | null;
  itemCount: number;
};

export const merchantSaleDraftSummarySchema = merchantSaleDraftSchema
  .pick({
    createdAt: true,
    currentStep: true,
    id: true,
    ownerUserId: true,
    revision: true,
    updatedAt: true,
  })
  .extend({
    customerLabel: z.string().nullable(),
    itemCount: z.number().int().nonnegative(),
  });
