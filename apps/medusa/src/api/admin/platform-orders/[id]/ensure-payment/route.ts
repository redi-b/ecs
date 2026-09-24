import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { ensureOrderPaymentWorkflow } from "../../../../../workflows/ensure-order-payment";

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id;
  if (!orderId) return res.status(400).json({ message: "Missing order ID" });
  await ensureOrderPaymentWorkflow(req.scope).run({ input: { order_id: orderId } });
  return res.status(200).json({ ok: true });
}
