import { atom, computed } from "nanostores";
import { CART_UPDATED_EVENT, setCartCount as syncCartCountBadge } from "../browser/cart-count";
import {
  projectCartAddition,
  projectCartItemQuantity,
  snapshotCart,
} from "../commerce/cart-optimistic";
import type { StoreCart, StoreCartItem } from "../commerce/types";

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
let cartRevision = 0;

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

const CART_STORAGE_KEY = "ecs_cart_cache";

function saveCartToStorage(cart: StoreCart | null) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (cart) {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } else {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  } catch {
    // ignore quota/storage issues
  }
}

function readCartFromStorage(): StoreCart | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function setCart(cart: StoreCart | null, broadcast = true) {
  cartRevision += 1;
  $cart.set(cart);
  saveCartToStorage(cart);
  if (broadcast) {
    broadcastCartUpdate(cart);
  }
}

export async function fetchCart(): Promise<StoreCart | null> {
  if (typeof window === "undefined") return null;
  const revision = cartRevision;
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
    if (revision !== cartRevision || $isCartMutating.get()) return $cart.get();
    setCart(result.cart, true);
    return result.cart;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load cart";
    if (revision === cartRevision && !$isCartMutating.get()) $cartError.set(msg);
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

export async function addToCart(
  options: AddToCartOptions,
): Promise<{ ok: boolean; cart?: StoreCart; error?: string }> {
  // One in-flight mutation prevents overlapping snapshots from erasing each other.
  if ($isCartMutating.get()) return { ok: false, error: "Cart is updating. Please try again." };
  const currentCart = $cart.get();
  const snapshot = snapshotCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);
  cartRevision += 1;

  const formData = options.form ? new FormData(options.form) : null;
  const rawQuantity = options.quantity ?? Number(formData?.get("quantity") ?? 1);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
  const variantId = options.variantId ?? formData?.get("variantId")?.toString();
  let optimisticItem = options.optimisticItem;
  if (!optimisticItem && options.form?.dataset.cartItem) {
    try {
      optimisticItem = JSON.parse(options.form.dataset.cartItem);
    } catch {
      /* Optional display hints only. */
    }
  }

  // Optimistic update
  if (variantId) {
    const base: StoreCart = currentCart ?? {
      id: "optimistic",
      regionId: null,
      email: null,
      currencyCode: "ETB",
      subtotal: 0,
      itemTotal: 0,
      itemSubtotal: 0,
      itemDiscountTotal: 0,
      shippingTotal: 0,
      shippingSubtotal: 0,
      shippingDiscountTotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      originalTotal: 0,
      total: 0,
      promotions: [],
      items: [],
    };
    const optimisticCart = projectCartAddition(base, {
      variantId,
      quantity,
      item: optimisticItem ?? { title: "Product" },
      optimisticId: `optimistic-${Date.now()}`,
    });
    $cart.set(optimisticCart);
    safeSyncBadge(optimisticCart.items.reduce((s, i) => s + Number(i.quantity || 0), 0));
  }
  if (options.openDrawer) $cartDrawerOpen.set(true);

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
    safeSyncBadge(snapshot?.items.reduce((s, i) => s + Number(i.quantity || 0), 0) ?? 0);
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
  if ($isCartMutating.get()) return { ok: false, error: "Cart is updating. Please try again." };
  cartRevision += 1;
  const currentCart = $cart.get();
  const snapshot = snapshotCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  // Optimistic update
  if (currentCart && Array.isArray(currentCart.items)) {
    const optimisticCart = projectCartItemQuantity(currentCart, lineItemId, quantity);
    $cart.set(optimisticCart);
    safeSyncBadge(optimisticCart.items.reduce((s, i) => s + Number(i.quantity || 0), 0));
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
      safeSyncBadge(snapshot.items.reduce((s, i) => s + Number(i.quantity || 0), 0));
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
  if ($isCartMutating.get()) return { ok: false, error: "Cart is updating. Please try again." };
  cartRevision += 1;
  const currentCart = $cart.get();
  const snapshot = snapshotCart(currentCart);
  $isCartMutating.set(true);
  $cartError.set(null);

  // Optimistic update
  if (currentCart && Array.isArray(currentCart.items)) {
    const optimisticCart = projectCartItemQuantity(currentCart, lineItemId, 0);
    $cart.set(optimisticCart);
    safeSyncBadge(optimisticCart.items.reduce((s, i) => s + Number(i.quantity || 0), 0));
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
      safeSyncBadge(snapshot.items.reduce((s, i) => s + Number(i.quantity || 0), 0));
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
  if ($isCartMutating.get()) return { ok: false, error: "Cart is updating. Please try again." };
  cartRevision += 1;
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

    // If cart is still null, hydrate from localStorage cache
    if (!$cart.get()) {
      const cached = readCartFromStorage();
      if (cached) {
        setCart(cached, false);
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
