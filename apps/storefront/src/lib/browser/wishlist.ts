export const WISHLIST_UPDATED_EVENT = "ecs:wishlist-updated";
export const WISHLIST_REQUEST_EVENT = "ecs:wishlist-request";

export interface WishlistEntry {
  path: string;
  title: string;
  thumbnail: string | null;
  priceAmount: number | null;
  currencyCode: string | null;
}

export interface WishlistStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const titleFromPath = (path: string) => {
  const slug = path.split("/").filter(Boolean).at(-1) || "Product";
  try {
    return decodeURIComponent(slug).replace(/[-_]+/g, " ");
  } catch {
    return slug.replace(/[-_]+/g, " ");
  }
};

export const normalizeWishlistEntry = (value: unknown): WishlistEntry | null => {
  if (typeof value === "string") {
    return {
      path: value,
      title: titleFromPath(value),
      thumbnail: null,
      priceAmount: null,
      currencyCode: null,
    };
  }
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.path !== "string" || !entry.path.trim()) return null;
  return {
    path: entry.path,
    title: typeof entry.title === "string" && entry.title.trim() ? entry.title : "Product",
    thumbnail: typeof entry.thumbnail === "string" ? entry.thumbnail : null,
    priceAmount: typeof entry.priceAmount === "number" && Number.isFinite(entry.priceAmount) ? entry.priceAmount : null,
    currencyCode: typeof entry.currencyCode === "string" ? entry.currencyCode : null,
  };
};

export const wishlistStorageKey = (shopScope: string) => `ecs:wishlist:${shopScope}`;

export const createWishlistStore = (storage: WishlistStorage, shopScope: string) => {
  const key = wishlistStorageKey(shopScope);
  const read = (): WishlistEntry[] => {
    let raw: unknown = [];
    try {
      raw = JSON.parse(storage.getItem(key) || "[]");
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    const normalized = raw
      .map(normalizeWishlistEntry)
      .filter((entry): entry is WishlistEntry => Boolean(entry));
    const unique = [...new Map(normalized.map((entry) => [entry.path, entry])).values()];
    if (JSON.stringify(raw) !== JSON.stringify(unique)) storage.setItem(key, JSON.stringify(unique));
    return unique;
  };
  const write = (items: WishlistEntry[]) => {
    const normalized = items
      .map(normalizeWishlistEntry)
      .filter((entry): entry is WishlistEntry => Boolean(entry));
    const unique = [...new Map(normalized.map((entry) => [entry.path, entry])).values()];
    storage.setItem(key, JSON.stringify(unique));
    return unique;
  };
  const toggle = (candidate: unknown) => {
    const entry = normalizeWishlistEntry(candidate);
    if (!entry) return read();
    const saved = read();
    return write(saved.some((item) => item.path === entry.path)
      ? saved.filter((item) => item.path !== entry.path)
      : [...saved, entry]);
  };
  const remove = (path: string) => write(read().filter((item) => item.path !== path));
  const clear = () => {
    if (storage.removeItem) storage.removeItem(key);
    else storage.setItem(key, "[]");
  };
  return { key, read, write, toggle, remove, clear };
};

const parseToggleEntry = (element: HTMLElement) => {
  try {
    return normalizeWishlistEntry(JSON.parse(element.dataset.wishlistItem || "null"));
  } catch {
    return null;
  }
};

interface WishlistControllerOptions {
  document?: Document;
  window?: Window;
  storage?: WishlistStorage;
  shopScope?: string;
  disabled?: boolean;
  fetcher?: typeof fetch;
}

export const initWishlistController = (options: WishlistControllerOptions = {}) => {
  const documentRef = options.document ?? document;
  const windowRef = options.window ?? window;
  const storage = options.storage ?? windowRef.localStorage;
  const shopScope = options.shopScope ?? windowRef.location.hostname;
  const disabled = options.disabled ?? documentRef.body.dataset.editorMode === "true";
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
  const store = createWishlistStore(storage, shopScope);
  let authenticated: boolean | null = null;
  let currentItems = disabled ? [] : store.read();
  let persistVersion = 0;
  const sync = (items = disabled ? [] : currentItems) => {
    currentItems = items;
    const paths = new Set(items.map((entry) => entry.path));
    documentRef.querySelectorAll<HTMLElement>("[data-wishlist-toggle]").forEach((button) => {
      const entry = parseToggleEntry(button);
      if (!entry) {
        button.setAttribute("aria-disabled", "true");
        return;
      }
      button.removeAttribute("aria-disabled");
      const active = !disabled && paths.has(entry.path);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active
        ? `Remove ${entry.title} from wishlist`
        : `Save ${entry.title} to wishlist`);
    });
    documentRef.querySelectorAll<HTMLElement>("[data-wishlist-indicator]").forEach((indicator) => {
      indicator.toggleAttribute("data-active", !disabled && items.length > 0);
      indicator.setAttribute("aria-label", items.length > 0 ? `Wishlist, ${items.length} saved` : "Wishlist");
    });
  };
  const setItems = (items: WishlistEntry[], persistGuest = false) => {
    const normalized = items
      .map(normalizeWishlistEntry)
      .filter((item): item is WishlistEntry => Boolean(item));
    currentItems = [...new Map(normalized.map((item) => [item.path, item])).values()];
    if (persistGuest && authenticated !== true) currentItems = store.write(currentItems);
    sync(currentItems);
    return currentItems;
  };
  const announce = () => {
    windowRef.dispatchEvent(new CustomEvent(WISHLIST_UPDATED_EVENT, {
      detail: { items: currentItems, origin: "controller" },
    }));
  };
  const publish = (items: WishlistEntry[]) => {
    const saved = setItems(items, true);
    announce();
    if (authenticated === true) void persist(saved);
  };
  const persist = async (items: WishlistEntry[]) => {
    if (disabled || !fetcher) return false;
    const version = ++persistVersion;
    try {
      const response = await fetcher("/actions/account/wishlist", {
        body: JSON.stringify({ items }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      if (!response.ok || version !== persistVersion) return false;
      const data = await response.json().catch(() => null) as { items?: unknown[] } | null;
      if (Array.isArray(data?.items)) {
        const normalized = data.items
          .map(normalizeWishlistEntry)
          .filter((item): item is WishlistEntry => Boolean(item));
        setItems(normalized);
      }
      return true;
    } catch {
      return false;
    }
  };
  const hydrateAccount = async () => {
    if (disabled || !fetcher) return false;
    try {
      const response = await fetcher("/actions/account/wishlist", { headers: { accept: "application/json" } });
      if (response.status === 401) {
        authenticated = false;
        setItems(store.read(), true);
        documentRef.querySelectorAll<HTMLElement>("[data-wishlist-account-copy]").forEach((node) => {
          node.textContent = "Saved on this device";
        });
        announce();
        return true;
      }
      if (!response.ok) return false;
      const data = await response.json().catch(() => null) as { items?: unknown[] } | null;
      if (!Array.isArray(data?.items)) return false;
      authenticated = true;
      const local = store.read();
      const remote = data.items.map(normalizeWishlistEntry).filter((item): item is WishlistEntry => Boolean(item));
      const merged = setItems([...remote, ...local]);
      announce();
      if (JSON.stringify(remote) !== JSON.stringify(merged)) await persist(merged);
      // Authenticated wishlist data belongs to the backend. Consuming the guest
      // list prevents account items from leaking back into the signed-out UI.
      store.clear();
      documentRef.querySelectorAll<HTMLElement>("[data-wishlist-account-copy]").forEach((node) => {
        node.textContent = "Saved to your account";
      });
      return true;
    } catch {
      return false;
    }
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-wishlist-toggle]")
      : null;
    if (!target || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const entry = parseToggleEntry(target);
    if (!entry) return;
    const next = currentItems.some((item) => item.path === entry.path)
      ? currentItems.filter((item) => item.path !== entry.path)
      : [...currentItems, entry];
    publish(next);
  };
  const onUpdate = (event: Event) => {
    const detail = (event as CustomEvent<{ items?: WishlistEntry[]; origin?: string }>).detail;
    const items = detail?.items;
    if (!Array.isArray(items)) return sync();
    const saved = setItems(items, true);
    if (detail?.origin !== "controller" && authenticated === true) void persist(saved);
  };
  const onRequest = () => {
    if (authenticated !== null) announce();
  };
  documentRef.addEventListener("click", onClick);
  windowRef.addEventListener(WISHLIST_UPDATED_EVENT, onUpdate);
  windowRef.addEventListener(WISHLIST_REQUEST_EVENT, onRequest);
  sync(currentItems);
  const ready = hydrateAccount();
  return {
    ready,
    store,
    sync,
    publish,
    destroy: () => {
      documentRef.removeEventListener("click", onClick);
      windowRef.removeEventListener(WISHLIST_UPDATED_EVENT, onUpdate);
      windowRef.removeEventListener(WISHLIST_REQUEST_EVENT, onRequest);
    },
  };
};
