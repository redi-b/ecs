import type { MerchantProduct } from "@ecs/contracts";

export type InventoryAvailabilityFilter = "low_stock" | "out_of_stock";

function availableQuantities(product: MerchantProduct) {
  return (product.variants ?? []).flatMap((variant) => {
    if (!variant.stock) return [];
    const quantity = variant.stock.availableQuantity ?? variant.stock.stockedQuantity;
    return typeof quantity === "number" && Number.isFinite(quantity) ? [quantity] : [];
  });
}

export function filterProductsByInventory(
  products: MerchantProduct[],
  filter: InventoryAvailabilityFilter,
  threshold: number,
) {
  return products.filter((product) => {
    const quantities = availableQuantities(product);
    if (filter === "out_of_stock") return quantities.some((quantity) => quantity <= 0);
    return quantities.some((quantity) => quantity <= threshold);
  });
}
