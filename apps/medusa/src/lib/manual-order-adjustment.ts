import { z } from "@medusajs/framework/zod";

export const manualOrderAdjustmentSchema = z.object({
  discount: z.object({
    type: z.enum(["fixed", "percentage"]),
    value: z.number().positive().finite(),
  }),
  reason: z.string().trim().min(3).max(240),
  tenant_id: z.string().trim().min(1).max(255),
  user_id: z.string().trim().min(1).max(255),
});

export type ManualOrderAdjustmentInput = z.infer<typeof manualOrderAdjustmentSchema>;
