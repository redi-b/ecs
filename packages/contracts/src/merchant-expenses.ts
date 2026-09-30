import { z } from "zod";

export const merchantExpenseCategorySchema = z.enum([
  "stock_supplies",
  "delivery_transport",
  "rent_utilities",
  "marketing",
  "fees",
  "wages",
  "tax",
  "other",
]);
export type MerchantExpenseCategory = z.infer<typeof merchantExpenseCategorySchema>;

export const merchantExpenseInputSchema = z.object({
  amount: z.number().int().positive().max(2_147_483_647),
  category: merchantExpenseCategorySchema,
  currencyCode: z.string().trim().toLowerCase().length(3).default("etb"),
  occurredOn: z.string().date(),
  vendorLabel: z.string().trim().max(160).nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
export type MerchantExpenseInput = z.infer<typeof merchantExpenseInputSchema>;

export const merchantExpenseSchema = merchantExpenseInputSchema.extend({
  actorUserId: z.string().min(1),
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  status: z.enum(["active", "void"]),
  tenantId: z.string().min(1),
  updatedAt: z.string().datetime(),
  voidedAt: z.string().datetime().nullable(),
  voidedByUserId: z.string().nullable(),
});
export type MerchantExpense = z.infer<typeof merchantExpenseSchema>;

export const merchantExpensesResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  expenses: z.array(merchantExpenseSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
});
