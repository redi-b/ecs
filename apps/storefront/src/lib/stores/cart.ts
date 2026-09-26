import { atom, computed } from "nanostores";
import type { StoreCart, StoreCartItem } from "../commerce/types";
import {
  projectCartAddition,
  projectCartItemQuantity,
  snapshotCart,
} from "../commerce/cart-optimistic";
import {
  CART_UPDATED_EVENT,
  setCartCount as syncCartCountBadge,
} from "../browser/cart-count";

export { CART_UPDATED_EVENT } from "../browser/cart-count";

export const $cart = atom<StoreCart | null>(null);
export const $isCartLoading = atom<boolean>(false);
export const $isCartMutating = atom<boolean>(false);
export const $cartError = atom<string | null>(null);
export const $cartDrawerOpen = atom<boolean>(false);

export const $cartCount = computed($cart, (cart) => {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
});

let listeningForUpdates = false;

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
  const snapshot = snapshotCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  const quantity = options.quantity ?? 1;
  const variantId = options.variantId ?? (options.form ? new FormData(options.form).get("variantId")?.toString() : undefined);

  // Optimistic update
  if (currentCart && variantId) {
    const optimisticCart = projectCartAddition(currentCart, {
      variantId,
      quantity,
      item: options.optimisticItem,
      optimisticId: `optimistic-${Date.now()}`,
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
  const snapshot = snapshotCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  // Optimistic update
  if (currentCart && Array.isArray(currentCart.items)) {
    const optimisticCart = projectCartItemQuantity(currentCart, lineItemId, quantity);
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
  const snapshot = snapshotCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  // Optimistic update
  if (currentCart && Array.isArray(currentCart.items)) {
    const optimisticCart = projectCartItemQuantity(currentCart, lineItemId, 0);
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
  const snapshot = snapshotCart(currentCart);
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

  if (typeof window !== "undefined" && !listeningForUpdates) {
    listeningForUpdates = true;
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
