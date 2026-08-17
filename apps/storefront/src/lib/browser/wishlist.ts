export const WISHLIST_UPDATED_EVENT = "ecs:wishlist-updated";

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
  return { key, read, write, toggle, remove };
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
}

export const initWishlistController = (options: WishlistControllerOptions = {}) => {
  const documentRef = options.document ?? document;
  const windowRef = options.window ?? window;
  const storage = options.storage ?? windowRef.localStorage;
  const shopScope = options.shopScope ?? windowRef.location.hostname;
  const disabled = options.disabled ?? documentRef.body.dataset.editorMode === "true";
  const store = createWishlistStore(storage, shopScope);
  const sync = (items = disabled ? [] : store.read()) => {
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
  const publish = (items: WishlistEntry[]) => {
    sync(items);
    windowRef.dispatchEvent(new CustomEvent(WISHLIST_UPDATED_EVENT, { detail: { items } }));
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
    publish(store.toggle(entry));
  };
  const onUpdate = (event: Event) => {
    const items = (event as CustomEvent<{ items?: WishlistEntry[] }>).detail?.items;
    sync(Array.isArray(items) ? items : undefined);
  };
  documentRef.addEventListener("click", onClick);
  windowRef.addEventListener(WISHLIST_UPDATED_EVENT, onUpdate);
  sync();
  return {
    store,
    sync,
    publish,
    destroy: () => {
      documentRef.removeEventListener("click", onClick);
      windowRef.removeEventListener(WISHLIST_UPDATED_EVENT, onUpdate);
    },
  };
};
