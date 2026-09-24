import { atom, computed } from "nanostores";
import {
  type WishlistEntry,
  normalizeWishlistEntry,
  createWishlistStore as createLocalWishlistStore,
  WISHLIST_UPDATED_EVENT,
} from "../browser/wishlist";

export const $wishlist = atom<WishlistEntry[]>([]);
export const $wishlistCount = computed($wishlist, (items) => items.length);
export const $isWishlistLoading = atom<boolean>(false);
export const $wishlistError = atom<string | null>(null);

let isAuthenticated: boolean | null = null;
let initialized = false;

export function getWishlist(): WishlistEntry[] {
  return $wishlist.get();
}

export function isItemWishlisted(path: string): boolean {
  return $wishlist.get().some((item) => item.path === path);
}

function syncDOMWishlistBadges(items: WishlistEntry[]) {
  if (typeof document === "undefined") return;
  const paths = new Set(items.map((entry) => entry.path));

  document.querySelectorAll<HTMLElement>("[data-wishlist-toggle]").forEach((button) => {
    try {
      const raw = button.dataset.wishlistItem;
      const entry = raw ? normalizeWishlistEntry(JSON.parse(raw)) : null;
      if (!entry) return;
      const active = paths.has(entry.path);
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("product-card__wishlist-btn--active", active);
      button.classList.toggle("product-details__wishlist-btn--active", active);
      button.setAttribute(
        "aria-label",
        active ? `Remove ${entry.title} from wishlist` : `Save ${entry.title} to wishlist`,
      );
    } catch {
      // Ignore parse error
    }
  });

  document.querySelectorAll<HTMLElement>("[data-wishlist-indicator]").forEach((indicator) => {
    indicator.toggleAttribute("data-active", items.length > 0);
    indicator.classList.toggle("is-active", items.length > 0);
    indicator.setAttribute(
      "aria-label",
      items.length > 0 ? `Wishlist, ${items.length} saved` : "Wishlist",
    );
  });
}

function broadcastWishlistUpdate(items: WishlistEntry[]) {
  if (typeof window === "undefined") return;
  syncDOMWishlistBadges(items);
  window.dispatchEvent(
    new CustomEvent(WISHLIST_UPDATED_EVENT, {
      detail: { items, origin: "nanostore" },
    }),
  );
}

export function setWishlist(items: WishlistEntry[], broadcast = true) {
  const normalized = items
    .map(normalizeWishlistEntry)
    .filter((item): item is WishlistEntry => Boolean(item));
  const unique = [...new Map(normalized.map((item) => [item.path, item])).values()];
  $wishlist.set(unique);
  if (broadcast) {
    broadcastWishlistUpdate(unique);
  }
}

export async function toggleWishlist(
  entryCandidate: unknown,
): Promise<{ saved: boolean; items: WishlistEntry[] }> {
  const entry = normalizeWishlistEntry(entryCandidate);
  if (!entry) return { saved: false, items: $wishlist.get() };

  const current = $wishlist.get();
  const snapshot = [...current];
  const isSaved = current.some((item) => item.path === entry.path);
  const next = isSaved
    ? current.filter((item) => item.path !== entry.path)
    : [...current, entry];

  // Optimistic update
  setWishlist(next, true);

  if (typeof window !== "undefined") {
    const shopScope = window.location.hostname;
    const localStore = createLocalWishlistStore(window.localStorage, shopScope);
    if (isAuthenticated !== true) {
      localStore.write(next);
    }

    if (isAuthenticated === true) {
      try {
        const response = await fetch("/actions/account/wishlist", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: next }),
        });
        if (!response.ok) {
          throw new Error("Failed to sync wishlist to account");
        }
      } catch (err) {
        // Rollback on remote error
        setWishlist(snapshot, true);
        const msg = err instanceof Error ? err.message : "Failed to update wishlist";
        $wishlistError.set(msg);
        return { saved: isSaved, items: snapshot };
      }
    }
  }

  return { saved: !isSaved, items: next };
}

export async function removeWishlistItem(path: string): Promise<WishlistEntry[]> {
  const current = $wishlist.get();
  const snapshot = [...current];
  const next = current.filter((item) => item.path !== path);

  setWishlist(next, true);

  if (typeof window !== "undefined") {
    const shopScope = window.location.hostname;
    const localStore = createLocalWishlistStore(window.localStorage, shopScope);
    if (isAuthenticated !== true) {
      localStore.write(next);
    }
    if (isAuthenticated === true) {
      try {
        const response = await fetch("/actions/account/wishlist", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: next }),
        });
        if (!response.ok) {
          throw new Error("Failed to sync wishlist removal");
        }
      } catch {
        setWishlist(snapshot, true);
      }
    }
  }

  return next;
}

export async function initWishlistStore() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  const shopScope = window.location.hostname;
  const localStore = createLocalWishlistStore(window.localStorage, shopScope);
  const initial = localStore.read();
  setWishlist(initial, false);
  syncDOMWishlistBadges(initial);

  // Subscribe to atom updates to keep DOM elements in sync
  $wishlist.subscribe((items) => {
    syncDOMWishlistBadges(items);
  });

  // Account hydration
  try {
    const response = await fetch("/actions/account/wishlist", {
      headers: { accept: "application/json" },
    });
    const data = (await response.json().catch(() => null)) as {
      authenticated?: boolean;
      items?: unknown[];
    } | null;

    if (response.status === 401 || data?.authenticated === false) {
      isAuthenticated = false;
      document.querySelectorAll<HTMLElement>("[data-wishlist-account-copy]").forEach((node) => {
        node.textContent = "Saved on this device";
      });
      return;
    }

    if (response.ok && Array.isArray(data?.items)) {
      isAuthenticated = true;
      const remote = data.items
        .map(normalizeWishlistEntry)
        .filter((item): item is WishlistEntry => Boolean(item));
      const local = localStore.read();
      const merged = [...new Map([...remote, ...local].map((i) => [i.path, i])).values()];
      setWishlist(merged, true);

      if (JSON.stringify(remote) !== JSON.stringify(merged)) {
        void fetch("/actions/account/wishlist", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: merged }),
        });
      }
      localStore.clear();
      document.querySelectorAll<HTMLElement>("[data-wishlist-account-copy]").forEach((node) => {
        node.textContent = "Saved to your account";
      });
    }
  } catch {
    isAuthenticated = false;
  }
}
