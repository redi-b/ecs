import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import type { ManualOrderAdjustmentInput } from "../../../../../lib/manual-order-adjustment";
import { applyManualOrderDiscountWorkflow } from "../../../../../workflows/apply-manual-order-discount";

export async function POST(
  req: AuthenticatedMedusaRequest<ManualOrderAdjustmentInput>,
  res: MedusaResponse,
) {
  const orderId = req.params.id;
  if (!orderId) return res.status(400).json({ message: "Missing draft order ID" });
  const { result } = await applyManualOrderDiscountWorkflow(req.scope).run({
    input: { ...req.validatedBody, order_id: orderId },
  });
  return res.status(200).json({ discount: result });
}
