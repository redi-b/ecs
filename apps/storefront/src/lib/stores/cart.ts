import { atom, computed } from "nanostores";
import type { StoreCart, StoreCartItem } from "../commerce/types";
import { setCartCount as syncCartCountBadge } from "../browser/cart-count";

export const CART_UPDATED_EVENT = "ecs:cart-updated";

export const $cart = atom<StoreCart | null>(null);
export const $isCartLoading = atom<boolean>(false);
export const $isCartMutating = atom<boolean>(false);
export const $cartError = atom<string | null>(null);
export const $cartDrawerOpen = atom<boolean>(false);

export const $cartCount = computed($cart, (cart) => {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
});

// Deep clone for snapshot rollback
function cloneCart(cart: StoreCart | null): StoreCart | null {
  if (!cart) return null;
  return JSON.parse(JSON.stringify(cart));
}

// Recalculate derived totals for optimistic previews
function recalculateCartTotals(cart: StoreCart): StoreCart {
  const items = Array.isArray(cart.items) ? cart.items : [];
  let itemTotal = 0;
  let itemSubtotal = 0;

  for (const item of items) {
    const unit = Number(item.unitPrice || 0);
    const qty = Number(item.quantity || 0);
    const lineSubtotal = item.subtotal != null ? Number(item.subtotal) : unit * qty;
    const lineTotal = item.total != null ? Number(item.total) : lineSubtotal;
    itemSubtotal += lineSubtotal;
    itemTotal += lineTotal;
  }

  const shippingTotal = Number(cart.shippingTotal || 0);
  const taxTotal = Number(cart.taxTotal || 0);
  const discountTotal = Number(cart.discountTotal || 0);

  return {
    ...cart,
    items,
    itemSubtotal,
    itemTotal,
    subtotal: itemSubtotal,
    total: Math.max(0, itemTotal + shippingTotal + taxTotal - discountTotal),
  };
}

function safeSyncBadge(count: number) {
  if (typeof document !== "undefined") {
    syncCartCountBadge(count);
  }
}

function broadcastCartUpdate(cart: StoreCart | null, openDrawer = false) {
  if (typeof window === "undefined") return;
  const count = cart?.items ? cart.items.reduce((s, i) => s + Number(i.quantity || 0), 0) : 0;
  safeSyncBadge(count);
  window.dispatchEvent(
    new CustomEvent(CART_UPDATED_EVENT, {
      detail: { cart, count, ok: true, openDrawer },
    }),
  );
}

export function setCart(cart: StoreCart | null, broadcast = true) {
  $cart.set(cart);
  if (broadcast) {
    broadcastCartUpdate(cart);
  }
}

export async function fetchCart(): Promise<StoreCart | null> {
  if (typeof window === "undefined") return null;
  $isCartLoading.set(true);
  $cartError.set(null);
  try {
    const response = await fetch("/cart-data", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Failed to load cart");
    }
    setCart(result.cart, true);
    return result.cart;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load cart";
    $cartError.set(msg);
    return null;
  } finally {
    $isCartLoading.set(false);
  }
}

export interface AddToCartOptions {
  form?: HTMLFormElement;
  variantId?: string;
  quantity?: number;
  optimisticItem?: Partial<StoreCartItem>;
  openDrawer?: boolean;
}

export async function addToCart(options: AddToCartOptions): Promise<{ ok: boolean; cart?: StoreCart; error?: string }> {
  const currentCart = $cart.get();
  const snapshot = cloneCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  const quantity = options.quantity ?? 1;
  const variantId = options.variantId ?? (options.form ? new FormData(options.form).get("variantId")?.toString() : undefined);

  // Optimistic update
  if (currentCart && variantId) {
    const updatedItems = [...(currentCart.items || [])];
    const existingIndex = updatedItems.findIndex((item) => item.variantId === variantId || item.id === variantId);
    if (existingIndex >= 0) {
      const existing = updatedItems[existingIndex];
      const newQty = Number(existing.quantity || 0) + quantity;
      const unit = Number(existing.unitPrice || 0);
      updatedItems[existingIndex] = {
        ...existing,
        quantity: newQty,
        total: unit * newQty,
        subtotal: unit * newQty,
      };
    } else if (options.optimisticItem) {
      const unit = Number(options.optimisticItem.unitPrice || 0);
      updatedItems.push({
        id: `optimistic-${Date.now()}`,
        variantId,
        title: options.optimisticItem.title || "Product",
        variantTitle: options.optimisticItem.variantTitle || null,
        thumbnail: options.optimisticItem.thumbnail || null,
        imageUrl: options.optimisticItem.imageUrl || null,
        productHandle: options.optimisticItem.productHandle || null,
        unitPrice: unit,
        quantity,
        total: unit * quantity,
        subtotal: unit * quantity,
        discountTotal: 0,
        originalTotal: unit * quantity,
      });
    }

    const optimisticCart = recalculateCartTotals({
      ...currentCart,
      items: updatedItems,
    });
    $cart.set(optimisticCart);
    safeSyncBadge(
      optimisticCart.items.reduce((s, i) => s + Number(i.quantity || 0), 0),
    );
  }

  try {
    let body: FormData;
    if (options.form) {
      body = new FormData(options.form);
    } else {
      body = new FormData();
      if (variantId) body.set("variantId", variantId);
      body.set("quantity", String(quantity));
    }

    const response = await fetch(options.form?.action || "/actions/cart/add", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Failed to add item to cart");
    }

    setCart(result.cart, true);
    if (options.openDrawer) {
      $cartDrawerOpen.set(true);
    }
    return { ok: true, cart: result.cart };
  } catch (error) {
    // Rollback to snapshot
    $cart.set(snapshot);
    if (snapshot) {
      safeSyncBadge(
        snapshot.items.reduce((s, i) => s + Number(i.quantity || 0), 0),
      );
    }
    const msg = error instanceof Error ? error.message : "Failed to add item to cart";
    $cartError.set(msg);
    return { ok: false, error: msg };
  } finally {
    $isCartMutating.set(false);
  }
}

export async function updateCartItemQuantity(
  lineItemId: string,
  quantity: number,
): Promise<{ ok: boolean; cart?: StoreCart; error?: string }> {
  const currentCart = $cart.get();
  const snapshot = cloneCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  // Optimistic update
  if (currentCart && Array.isArray(currentCart.items)) {
    let updatedItems: StoreCartItem[];
    if (quantity <= 0) {
      updatedItems = currentCart.items.filter((item) => item.id !== lineItemId);
    } else {
      updatedItems = currentCart.items.map((item) => {
        if (item.id === lineItemId) {
          const unit = Number(item.unitPrice || 0);
          return {
            ...item,
            quantity,
            total: unit * quantity,
            subtotal: unit * quantity,
          };
        }
        return item;
      });
    }

    const optimisticCart = recalculateCartTotals({
      ...currentCart,
      items: updatedItems,
    });
    $cart.set(optimisticCart);
    safeSyncBadge(
      optimisticCart.items.reduce((s, i) => s + Number(i.quantity || 0), 0),
    );
  }

  try {
    const body = new FormData();
    body.set("lineItemId", lineItemId);
    body.set("quantity", String(quantity));

    const response = await fetch("/actions/cart/update", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Failed to update item quantity");
    }

    setCart(result.cart, true);
    return { ok: true, cart: result.cart };
  } catch (error) {
    // Rollback to snapshot
    $cart.set(snapshot);
    if (snapshot) {
      safeSyncBadge(
        snapshot.items.reduce((s, i) => s + Number(i.quantity || 0), 0),
      );
    }
    const msg = error instanceof Error ? error.message : "Failed to update item quantity";
    $cartError.set(msg);
    return { ok: false, error: msg };
  } finally {
    $isCartMutating.set(false);
  }
}

export async function removeCartItem(
  lineItemId: string,
): Promise<{ ok: boolean; cart?: StoreCart; error?: string }> {
  const currentCart = $cart.get();
  const snapshot = cloneCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  // Optimistic update
  if (currentCart && Array.isArray(currentCart.items)) {
    const updatedItems = currentCart.items.filter((item) => item.id !== lineItemId);
    const optimisticCart = recalculateCartTotals({
      ...currentCart,
      items: updatedItems,
    });
    $cart.set(optimisticCart);
    safeSyncBadge(
      optimisticCart.items.reduce((s, i) => s + Number(i.quantity || 0), 0),
    );
  }

  try {
    const body = new FormData();
    body.set("lineItemId", lineItemId);

    const response = await fetch("/actions/cart/remove", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Failed to remove item from cart");
    }

    setCart(result.cart, true);
    return { ok: true, cart: result.cart };
  } catch (error) {
    // Rollback to snapshot
    $cart.set(snapshot);
    if (snapshot) {
      safeSyncBadge(
        snapshot.items.reduce((s, i) => s + Number(i.quantity || 0), 0),
      );
    }
    const msg = error instanceof Error ? error.message : "Failed to remove item from cart";
    $cartError.set(msg);
    return { ok: false, error: msg };
  } finally {
    $isCartMutating.set(false);
  }
}

export async function applyPromotion(
  code: string,
  intent: "apply" | "remove" = "apply",
): Promise<{ ok: boolean; cart?: StoreCart; error?: string }> {
  const currentCart = $cart.get();
  const snapshot = cloneCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  try {
    const body = new FormData();
    body.set("code", code);
    body.set("intent", intent);

    const response = await fetch("/actions/cart/promotion", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Failed to update discount code");
    }

    setCart(result.cart, true);
    return { ok: true, cart: result.cart };
  } catch (error) {
    $cart.set(snapshot);
    const msg = error instanceof Error ? error.message : "Failed to update discount code";
    $cartError.set(msg);
    return { ok: false, error: msg };
  } finally {
    $isCartMutating.set(false);
  }
}

export function initCartStore(initialCart?: StoreCart | null) {
  if (initialCart) {
    setCart(initialCart, false);
  } else if (typeof document !== "undefined") {
    // Attempt hydration from server injected JSON scripts
    const stateScript =
      document.getElementById("luvia-cart-state") ||
      document.getElementById("afro-cart-state") ||
      document.getElementById("nexahub-cart-state");
    if (stateScript?.textContent) {
      try {
        const parsed = JSON.parse(stateScript.textContent);
        if (parsed && typeof parsed === "object") {
          setCart(parsed, false);
        }
      } catch {
        // Fallback to async fetch
      }
    }
  }

  if (typeof window !== "undefined") {
    // Listen for external cart update events to keep $cart synced
    window.addEventListener(CART_UPDATED_EVENT, ((event: CustomEvent) => {
      const detail = event.detail;
      if (detail?.cart && detail.cart !== $cart.get()) {
        $cart.set(detail.cart);
      }
      if (detail?.openDrawer) {
        $cartDrawerOpen.set(true);
      }
    }) as EventListener);

    // Initial badge sync
    const current = $cart.get();
    if (current?.items) {
      safeSyncBadge(current.items.reduce((s, i) => s + Number(i.quantity || 0), 0));
    }
  }
}
