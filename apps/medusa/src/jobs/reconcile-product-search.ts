import type { MedusaContainer } from "@medusajs/framework/types";

import { reindexProductSearch } from "../lib/reindex-product-search";

export default async function reconcileProductSearch(container: MedusaContainer) {
  await reindexProductSearch(container);
}

export const config = {
  name: "reconcile-product-search",
  schedule: "17 2 * * *",
};
