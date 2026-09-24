/** Default: notify when available/stocked quantity is at or below this. */
export function getLowStockThreshold(): number {
  const raw = process.env.INVENTORY_LOW_STOCK_THRESHOLD?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 5;
}

export function shouldNotifyLowStock(quantity: number | null | undefined): boolean {
  if (quantity == null || !Number.isFinite(quantity)) {
    return false;
  }
  return quantity <= getLowStockThreshold();
}

export function buildInventoryLowPayload(input: {
  productId: string;
  variantId?: string | null;
  availableQuantity?: number | null;
  stockedQuantity?: number | null;
  productTitle?: string | null;
  variantTitle?: string | null;
}): Record<string, unknown> {
  const available =
    input.availableQuantity != null && Number.isFinite(input.availableQuantity)
      ? input.availableQuantity
      : input.stockedQuantity;
  const payload: Record<string, unknown> = {
    productId: input.productId,
    threshold: getLowStockThreshold(),
  };
  if (input.variantId) {
    payload.variantId = input.variantId;
  }
  if (available != null && Number.isFinite(available)) {
    payload.availableQuantity = available;
    payload.stockedQuantity = available;
  }
  if (input.productTitle?.trim()) {
    payload.productTitle = input.productTitle.trim();
  }
  if (input.variantTitle?.trim()) {
    payload.variantTitle = input.variantTitle.trim();
  }
  return payload;
}
