import type { ExecArgs } from "@medusajs/framework/types";

import { reindexProductSearch } from "../lib/reindex-product-search";

export default async function reindex({ container }: ExecArgs) {
  const result = await reindexProductSearch(container);
  console.info(JSON.stringify(result));
}
