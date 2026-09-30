import { z } from "zod";
import { merchantOrderSchema } from "./order";

export const merchantSalesDocumentKindSchema = z.enum([
  "order_summary",
  "payment_receipt",
  "packing_slip",
]);
export type MerchantSalesDocumentKind = z.infer<typeof merchantSalesDocumentKindSchema>;

export const merchantDocumentBrandingSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  address: z.string().trim().max(1_000).nullable(),
  email: z.string().trim().max(254).nullable(),
  footerNote: z.string().trim().max(240).nullable(),
  logoUrl: z
    .string()
    .trim()
    .url()
    .max(2_000)
    .regex(/^https?:\/\//i)
    .nullable(),
  phone: z.string().trim().max(40).nullable(),
});
export type MerchantDocumentBranding = z.infer<typeof merchantDocumentBrandingSchema>;

export const merchantSalesDocumentSnapshotSchema = z.object({
  complianceStatus: z.literal("operational_only"),
  currencyCode: z.literal("etb"),
  disclaimer: z.string().min(1),
  issuedAt: z.string().datetime(),
  kind: merchantSalesDocumentKindSchema,
  language: z.enum(["en", "am"]),
  order: merchantOrderSchema,
  orderReference: z.string().min(1),
  sellerName: z.string().min(1),
  branding: merchantDocumentBrandingSchema.optional(),
  templateVersion: z.union([z.literal(1), z.literal(2)]),
});
export type MerchantSalesDocumentSnapshot = z.infer<typeof merchantSalesDocumentSnapshotSchema>;

export const merchantSalesDocumentSchema = z.object({
  contentHash: z.string().min(1),
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  kind: merchantSalesDocumentKindSchema,
  language: z.enum(["en", "am"]),
  number: z.string().min(1),
  orderId: z.string().min(1),
  snapshot: merchantSalesDocumentSnapshotSchema,
});
export type MerchantSalesDocument = z.infer<typeof merchantSalesDocumentSchema>;

export const merchantSalesDocumentResponseSchema = z.object({
  document: merchantSalesDocumentSchema,
});

export const merchantSalesDocumentsResponseSchema = z.object({
  documents: z.array(merchantSalesDocumentSchema),
});

export const merchantOperationsDocumentKindSchema = z.enum([
  "quotation",
  "order_summary",
  "payment_receipt",
  "packing_slip",
]);
export type MerchantOperationsDocumentKind = z.infer<typeof merchantOperationsDocumentKindSchema>;

export const merchantOperationsDocumentSummarySchema = z.object({
  createdAt: z.string().datetime(),
  customerLabel: z.string().nullable(),
  id: z.string().min(1),
  issuedAt: z.string().datetime(),
  kind: merchantOperationsDocumentKindSchema,
  language: z.enum(["en", "am"]),
  number: z.string().min(1),
  orderId: z.string().min(1).nullable(),
  orderReference: z.string().min(1).nullable(),
  status: z.string().min(1).nullable(),
  total: z.number().nonnegative().nullable(),
});
export type MerchantOperationsDocumentSummary = z.infer<
  typeof merchantOperationsDocumentSummarySchema
>;

export const merchantOperationsDocumentsResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  documents: z.array(merchantOperationsDocumentSummarySchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
