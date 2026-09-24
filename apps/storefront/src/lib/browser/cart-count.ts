export const CART_UPDATED_EVENT = "ecs:cart-updated";

export const setCartCount = (count: number, root: ParentNode = document) => {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  root.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((element) => {
    element.textContent = safeCount > 0 ? String(safeCount) : "";
    element.toggleAttribute("hidden", safeCount <= 0);
    element.setAttribute("data-count", String(safeCount));
    element.setAttribute("aria-label", `${safeCount} cart item${safeCount === 1 ? "" : "s"}`);
    if (safeCount > 0) {
      element.classList.remove("is-bump");
      void element.offsetWidth;
      element.classList.add("is-bump");
    }
  });
  root.querySelectorAll<HTMLElement>("[data-cart-count-label]").forEach((element) => {
    element.textContent = safeCount > 0 ? ` (${safeCount})` : "";
  });
  return safeCount;
};

export const loadAndSyncCartCount = async ({
  root = document,
  fetcher = fetch,
  endpoint = "/cart-count",
}: {
  root?: ParentNode;
  fetcher?: typeof fetch;
  endpoint?: string;
} = {}) => {
  try {
    const response = await fetcher(endpoint, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return setCartCount(typeof payload?.count === "number" ? payload.count : 0, root);
  } catch {
    return null;
  }
};
