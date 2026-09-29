import { z } from "zod";
import { merchantOrderSchema } from "./order";

export const merchantSalesDocumentKindSchema = z.enum([
  "order_summary",
  "payment_receipt",
  "packing_slip",
]);
export type MerchantSalesDocumentKind = z.infer<typeof merchantSalesDocumentKindSchema>;

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
  templateVersion: z.literal(1),
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
