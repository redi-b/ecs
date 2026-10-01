import {
  $cart,
  $cartDrawerOpen,
  $cartError,
  $isCartLoading,
  $isCartMutating,
} from "../stores/cart";

/** Template-neutral pending totals and failure feedback; no optimistic discounts. */
export function initCartFeedback() {
  const messages = (() => {
    const globals = window as Window & {
      __ECS_NEXAHUB_MESSAGES__?: Record<string, string>;
      __ECS_AFRO_MESSAGES__?: Record<string, string>;
    };
    if (globals.__ECS_NEXAHUB_MESSAGES__) return globals.__ECS_NEXAHUB_MESSAGES__;
    if (globals.__ECS_AFRO_MESSAGES__) return globals.__ECS_AFRO_MESSAGES__;
    try {
      return JSON.parse(document.body.dataset.clientMessages || "{}");
    } catch {
      return {};
    }
  })();
  const update = () => {
    const pending = $isCartLoading.get() || $isCartMutating.get();
    document
      .querySelectorAll<HTMLElement>("[data-cart-drawer], [data-cart-modal]")
      .forEach((drawer) => {
        drawer.setAttribute("aria-busy", String(pending));
        const items = drawer.querySelector<HTMLElement>("[data-cart-items]");
        if (items && $isCartLoading.get() && !$cart.get()) {
          if (!items.querySelector("[data-cart-loading-skeleton]")) {
            const skeleton = document.createElement("div");
            skeleton.dataset.cartLoadingSkeleton = "";
            skeleton.setAttribute("aria-hidden", "true");
            for (let index = 0; index < 3; index++) {
              const row = document.createElement("div");
              row.className = "ecs-cart-loading-row";
              const image = document.createElement("span");
              image.className = "ecs-cart-pending-total";
              const copy = document.createElement("span");
              copy.className = "ecs-cart-pending-total";
              row.append(image, copy);
              skeleton.append(row);
            }
            items.replaceChildren(skeleton);
            items.hidden = false;
          }
        } else items?.querySelector("[data-cart-loading-skeleton]")?.remove();
        drawer
          .querySelectorAll<HTMLElement>(
            "[data-cart-subtotal], [data-cart-total], [data-cart-discount]",
          )
          .forEach((node) => {
            node.classList.toggle("ecs-cart-pending-total", pending);
            if (pending) node.setAttribute("aria-label", messages.cartUpdating || "Updating cart");
            else node.removeAttribute("aria-label");
          });
        drawer.querySelectorAll<HTMLElement>('a[href*="checkout"]').forEach((link) => {
          link.setAttribute("aria-disabled", String(pending));
        });
        const status = drawer.querySelector<HTMLElement>("[data-cart-status]");
        if (status) {
          status.textContent = $cartError.get()
            ? messages.cartUpdateFailed || "Could not update your cart. Please try again."
            : pending
              ? messages.cartUpdating || "Updating cart"
              : "";
        }
      });
  };
  let active = true;
  const afterRender = () =>
    queueMicrotask(() => {
      if (active) update();
    });
  const subscriptions = [
    $isCartLoading.subscribe(update),
    $isCartMutating.subscribe(update),
    $cartError.subscribe(update),
    // Template subscriptions rebuild item/total nodes synchronously; mark the new
    // nodes after those subscribers have run, not the discarded previous markup.
    $cart.subscribe(afterRender),
    $cartDrawerOpen.subscribe(afterRender),
  ];
  const onClick = (event: MouseEvent) => {
    if (!$isCartLoading.get() && !$isCartMutating.get()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest(
        '[data-cart-drawer] a[href*="checkout"], [data-cart-modal] a[href*="checkout"], [data-cart-quantity], [data-cart-remove]',
      )
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  document.addEventListener("click", onClick, true);
  return () => {
    active = false;
    subscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    document.removeEventListener("click", onClick, true);
  };
}
