type DemoItem = {
  id: string;
  title: string;
  quantity: number;
};

const storagePrefix = "ecs-demo-cart:";

/**
 * Deliberately bounded demo interactions. Demo storefronts never call the
 * merchant cart or checkout endpoints; they only demonstrate add-to-cart
 * feedback inside the current browser session.
 */
export function initDemoActions() {
  if (typeof window === "undefined" || document.body.dataset.demoMode !== "true") return;
  const slug = window.location.pathname.split("/").filter(Boolean)[0] || "storefront";
  const key = `${storagePrefix}${window.location.host}:${slug}`;
  const read = (): DemoItem[] => {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(key) ?? "[]") as unknown;
      return Array.isArray(value) ? value.filter(isItem) : [];
    } catch {
      return [];
    }
  };
  const write = (items: DemoItem[]) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(items.slice(0, 40)));
    } catch {
      // Demo feedback still works if storage is unavailable.
    }
  };
  const announce = (message: string) => {
    let node = document.querySelector<HTMLElement>("[data-demo-feedback]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.demoFeedback = "true";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      Object.assign(node.style, {
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: "1100",
        maxWidth: "min(22rem, calc(100vw - 2rem))",
        padding: "0.75rem 1rem",
        border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
        borderRadius: "999px",
        background: "Canvas",
        color: "CanvasText",
        boxShadow: "0 10px 30px rgb(0 0 0 / 0.14)",
      });
      document.body.append(node);
    }
    node.textContent = message;
    window.clearTimeout(Number(node.dataset.dismissTimer));
    node.dataset.dismissTimer = String(window.setTimeout(() => node?.remove(), 4200));
  };
  const syncCount = () => {
    const count = read().reduce((sum, item) => sum + item.quantity, 0);
    document
      .querySelectorAll<HTMLElement>("[data-cart-count], [data-cart-drawer-count]")
      .forEach((node) => {
        node.textContent = String(count);
        node.hidden = count === 0;
      });
    return count;
  };
  document.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form?.matches("[data-card-add-form], [data-add-form]")) return;
    event.preventDefault();
    const raw = form.dataset.cartItem;
    let item: Partial<DemoItem> = {};
    try {
      item = raw ? (JSON.parse(raw) as Partial<DemoItem>) : {};
    } catch {
      // Invalid fixture metadata should not break the demo page.
    }
    const id =
      form.querySelector<HTMLInputElement>("[name=variantId]")?.value || crypto.randomUUID();
    const title = typeof item.title === "string" && item.title.trim() ? item.title : "Product";
    const items = read();
    const existing = items.find((candidate) => candidate.id === id);
    if (existing) existing.quantity += 1;
    else items.push({ id, title, quantity: 1 });
    write(items);
    const count = syncCount();
    announce(`${title} added to the demo cart · ${count} item${count === 1 ? "" : "s"}`);
  });
  document
    .querySelectorAll<HTMLElement>("[data-cart-open], [data-cart-trigger], #cart-toggle-btn")
    .forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        if (trigger.matches("a")) event.preventDefault();
        const count = syncCount();
        announce(`Demo cart · ${count} item${count === 1 ? "" : "s"}. Checkout is preview-only.`);
      });
    });
  syncCount();
}

function isItem(value: unknown): value is DemoItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.quantity === "number" &&
    item.quantity > 0
  );
}
