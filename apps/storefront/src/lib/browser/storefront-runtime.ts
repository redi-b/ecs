import { initCartStore } from "../stores/cart";
import { initWishlistController } from "./wishlist";

let initialized = false;

/** Mounts the template-neutral shopping state used by every storefront shell. */
export function initStorefrontRuntime() {
  if (initialized) return;
  initialized = true;
  initCartStore();
  initWishlistController();
}
