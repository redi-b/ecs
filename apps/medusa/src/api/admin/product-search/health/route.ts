import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { MEILISEARCH_MODULE } from "../../../../modules/meilisearch";
import type { ProductSearchProvider } from "../../../../modules/meilisearch/types";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const search = req.scope.resolve<ProductSearchProvider>(MEILISEARCH_MODULE);
  const status = await search.status();
  return res.status(status.available && status.documentCount !== null ? 200 : 503).json({
    available: status.available,
    document_count: status.documentCount,
    populated: status.documentCount !== null && status.documentCount > 0,
  });
}
