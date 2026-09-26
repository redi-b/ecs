import type { StoreCart, StoreCartItem } from "./types";

export const snapshotCart = (cart: StoreCart | null): StoreCart | null =>
  cart ? structuredClone(cart) : null;

export const projectCartAddition = (
  cart: StoreCart,
  {
    variantId,
    quantity,
    item,
    optimisticId,
  }: {
    variantId: string;
    quantity: number;
    item?: Partial<StoreCartItem>;
    optimisticId: string;
  },
): StoreCart => {
  const items = [...(cart.items ?? [])];
  const existingIndex = items.findIndex(
    (candidate) => candidate.variantId === variantId || candidate.id === variantId,
  );

  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      quantity: Number(items[existingIndex].quantity || 0) + quantity,
    };
  } else if (item) {
    const unitPrice = Number(item.unitPrice || 0);
    items.push({
      id: optimisticId,
      variantId,
      title: item.title || "Product",
      variantTitle: item.variantTitle || null,
      thumbnail: item.thumbnail || null,
      imageUrl: item.imageUrl || null,
      productHandle: item.productHandle || null,
      unitPrice,
      quantity,
      total: unitPrice * quantity,
      subtotal: unitPrice * quantity,
      discountTotal: 0,
      originalTotal: unitPrice * quantity,
    });
  }

  return { ...cart, items };
};

export const projectCartItemQuantity = (
  cart: StoreCart,
  lineItemId: string,
  quantity: number,
): StoreCart => ({
  ...cart,
  items:
    quantity <= 0
      ? cart.items.filter((item) => item.id !== lineItemId)
      : cart.items.map((item) =>
          item.id === lineItemId ? { ...item, quantity } : item,
        ),
});
