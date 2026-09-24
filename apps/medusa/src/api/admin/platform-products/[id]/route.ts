import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import type { PlatformProductUpdateInput } from "../../../../lib/platform-product-update";
import { updatePlatformProductWorkflow } from "../../../../workflows/update-platform-product";

export async function POST(
  req: AuthenticatedMedusaRequest<PlatformProductUpdateInput>,
  res: MedusaResponse,
) {
  const productId = req.params.id;
  if (!productId) return res.status(400).json({ message: "Missing product ID" });

  const { result } = await updatePlatformProductWorkflow(req.scope).run({
    input: { ...req.validatedBody, product_id: productId },
  });
  return res.status(200).json({ product: result[0] });
}
