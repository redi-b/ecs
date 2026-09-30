import { z } from "zod";
import { merchantSaleDraftContentSchema } from "./merchant-sale-drafts";
import { merchantDocumentBrandingSchema } from "./merchant-sales-documents";

export const merchantQuotationStatusSchema = z.enum([
  "issued",
  "accepted",
  "declined",
  "converted",
  "voided",
]);

export const merchantQuotationSnapshotSchema = merchantSaleDraftContentSchema.extend({
  draftId: z.string().min(1),
  draftRevision: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  issuedAt: z.string().datetime(),
  language: z.enum(["en", "am"]),
  sellerName: z.string().trim().min(1).max(160),
  branding: merchantDocumentBrandingSchema.optional(),
  templateVersion: z.union([z.literal(1), z.literal(2)]),
});

export type MerchantQuotationSnapshot = z.infer<typeof merchantQuotationSnapshotSchema>;

export const merchantQuotationRevisionSchema = z.object({
  createdAt: z.string().datetime(),
  createdByUserId: z.string().min(1),
  revision: z.number().int().positive(),
  snapshot: merchantQuotationSnapshotSchema,
});

export const merchantQuotationSchema = z.object({
  convertedOrderId: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  currentRevision: z.number().int().positive(),
  id: z.string().min(1),
  number: z.string().min(1),
  snapshot: merchantQuotationSnapshotSchema,
  status: merchantQuotationStatusSchema,
  updatedAt: z.string().datetime(),
});

export const merchantQuotationSummarySchema = merchantQuotationSchema
  .pick({
    convertedOrderId: true,
    createdAt: true,
    currentRevision: true,
    id: true,
    number: true,
    status: true,
    updatedAt: true,
  })
  .extend({
    customerLabel: z.string().nullable(),
    expiresAt: z.string().datetime(),
    issuedAt: z.string().datetime(),
    language: z.enum(["en", "am"]),
    pricingComplete: z.boolean(),
    total: z.number().nonnegative(),
  });

export type MerchantQuotation = z.infer<typeof merchantQuotationSchema>;
export type MerchantQuotationRevision = z.infer<typeof merchantQuotationRevisionSchema>;
export type MerchantQuotationStatus = z.infer<typeof merchantQuotationStatusSchema>;
export type MerchantQuotationSummary = z.infer<typeof merchantQuotationSummarySchema>;

export function merchantQuotationTotal(snapshot: MerchantQuotationSnapshot): number {
  const subtotal = snapshot.items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
    0,
  );
  if (!snapshot.discount) return subtotal;
  const discount =
    snapshot.discount.type === "fixed"
      ? snapshot.discount.value
      : subtotal * (snapshot.discount.value / 100);
  return Math.max(0, subtotal - discount);
}
