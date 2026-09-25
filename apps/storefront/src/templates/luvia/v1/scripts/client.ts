import { setCartCount as syncCartCount } from "../../../../lib/browser/cart-count";
import { initProductSearchSuggestions } from "../../../../lib/browser/product-search-suggestions";
import {
  $cart,
  $cartDrawerOpen,
  initCartStore,
  fetchCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  applyPromotion,
} from "../../../../lib/stores/cart";
import { initWishlistStore } from "../../../../lib/stores/wishlist";

function getClientMessages(): Record<string, string> {
  try {
    return JSON.parse(document.body.dataset.clientMessages || "{}");
  } catch {
    return {};
  }
}

function formatCartMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "—";
  const locale = document.documentElement.lang === "am" ? "am-ET" : "en-ET";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: (currency || "ETB").toUpperCase(),
    }).format(amount);
  } catch {
    return String(amount);
  }
}

/**
 * Initializes global Luvia header, navigation, and cart drawer interactions.
 */
export function initLuviaStorefront() {
  const editorPreview = document.body.dataset.editorMode === "true";
  const demoPreview = document.body.dataset.demoMode === "true";
  const readOnlyPreview = editorPreview || demoPreview;
  const messages = getClientMessages();

  // Header & Search
  const menu = document.querySelector<HTMLButtonElement>(".menu");
  const nav = document.querySelector<HTMLElement>(".nav");
  const headerBackdrop = document.querySelector<HTMLButtonElement>("[data-header-backdrop]");
  const searchForm = document.querySelector<HTMLFormElement>(".search");
  const searchInput = searchForm?.querySelector<HTMLInputElement>('input[type="search"]');
  const searchButton = searchForm?.querySelector<HTMLButtonElement>('button[type="submit"]');

  if (!readOnlyPreview && searchForm) {
    initProductSearchSuggestions(searchForm);
  }

  let headerSurface: "menu" | "search" | null = null;
  let headerCloseTimer = 0;

  const syncPageScrollLock = () => {
    const locked = headerSurface !== null || document.body.hasAttribute("data-cart-open");
    document.documentElement.toggleAttribute("data-overlay-open", locked);
    document.body.toggleAttribute("data-overlay-open", locked);
    window.dispatchEvent(new CustomEvent("ecs:overlay-lock-change", { detail: { locked } }));
  };

  const setHeaderSurface = (surface: "menu" | "search" | null, restoreFocus = false) => {
    window.clearTimeout(headerCloseTimer);
    const previous = headerSurface;
    headerSurface = surface;
    const menuOpen = surface === "menu";
    const searchOpen = surface === "search";

    menu?.setAttribute("aria-expanded", String(menuOpen));
    searchButton?.setAttribute("aria-expanded", String(searchOpen));
    nav?.toggleAttribute("data-open", menuOpen);
    searchForm?.toggleAttribute("data-open", searchOpen);
    if (searchInput) searchInput.toggleAttribute("data-open", searchOpen);

    document.body.toggleAttribute("data-header-open", surface !== null);
    syncPageScrollLock();

    if (surface && headerBackdrop) {
      headerBackdrop.hidden = false;
      headerBackdrop.setAttribute("aria-label", surface === "menu" ? "Close navigation" : "Close search");
      requestAnimationFrame(() => headerBackdrop.toggleAttribute("data-open", true));
    } else if (headerBackdrop) {
      headerBackdrop.removeAttribute("data-open");
      headerCloseTimer = window.setTimeout(() => {
        headerBackdrop.hidden = true;
      }, 220);
    }

    if (searchOpen) requestAnimationFrame(() => searchInput?.focus());
    if (!surface && restoreFocus) (previous === "menu" ? menu : searchButton)?.focus();
  };

  menu?.addEventListener("click", () => setHeaderSurface(headerSurface === "menu" ? null : "menu"));
  nav?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("a")) return;
    setHeaderSurface(null);
  });
  headerBackdrop?.addEventListener("click", () => setHeaderSurface(null, true));

  searchButton?.addEventListener("click", (event) => {
    if (window.matchMedia("(max-width: 760px)").matches && headerSurface !== "search") {
      event.preventDefault();
      setHeaderSurface("search");
    }
  });

  searchForm?.addEventListener("submit", (event) => {
    if (searchInput?.value.trim()) return;
    event.preventDefault();
    if (window.matchMedia("(max-width: 760px)").matches) setHeaderSurface("search");
    searchInput?.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !headerSurface) return;
    event.preventDefault();
    setHeaderSurface(null, true);
  });

  window.matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
    if (event.matches) setHeaderSurface(null);
  });

  // Cart Drawer
  const trigger = document.querySelector<HTMLAnchorElement>("[data-cart-trigger]");
  const drawer = document.querySelector<HTMLElement>("[data-cart-drawer]");
  const backdrop = document.querySelector<HTMLButtonElement>("[data-cart-backdrop]");
  const closeButton = drawer?.querySelector<HTMLButtonElement>("[data-cart-close]");
  const continueButton = drawer?.querySelector<HTMLButtonElement>("[data-cart-continue]");
  const itemsRoot = drawer?.querySelector<HTMLElement>("[data-cart-items]");
  const drawerCount = drawer?.querySelector<HTMLElement>("[data-cart-drawer-count]");
  const drawerFooter = drawer?.querySelector<HTMLElement>("[data-cart-footer]");
  let lastFocused: HTMLElement | null = null;

  const setCartCount = (count: number) => {
    syncCartCount(count);
    if (drawerCount) {
      drawerCount.textContent = (messages.cartItemCount || "__COUNT__ items").replace(
        "__COUNT__",
        String(count),
      );
    }
  };

  const createNode = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  };

  const renderDrawerCart = (cart: any) => {
    if (!itemsRoot || !drawerFooter) return;
    itemsRoot.replaceChildren();
    const cartItems = Array.isArray(cart?.items) ? cart.items : [];
    setCartCount(cartItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0));

    if (!cartItems.length) {
      const empty = createNode("div", "cart-empty empty-state");
      const mark = createNode("span", "empty-state__mark");
      mark.innerHTML =
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>';
      const copy = createNode("div", "empty-state__copy");
      copy.append(
        createNode("h3", "empty-state__title type-heading-3", messages.cartEmpty || "Your cart is empty"),
        createNode("p", "empty-state__text type-body-400", messages.cartEmptyHelp || "Add pieces to start your order."),
      );
      const shop = createNode("a", "empty-state__action type-body-500", messages.continueShopping || "Continue shopping");
      shop.href = "/products";
      empty.append(mark, copy, shop);
      itemsRoot.append(empty);
      drawerFooter.hidden = true;
      return;
    }

    for (const item of cartItems) {
      const article = createNode("article", "cart-item");
      article.dataset.lineItemId = item.id;
      const media = createNode("a", "cart-item__media") as HTMLAnchorElement;
      media.href = item.productHandle ? `/products/${encodeURIComponent(item.productHandle)}` : "/products";
      const itemMedia = item.imageUrl || item.thumbnail;
      if (itemMedia) {
        const img = createNode("img") as HTMLImageElement;
        img.src = itemMedia;
        img.alt = "";
        media.append(img);
      }

      const copy = createNode("div", "cart-item__copy");
      copy.append(createNode("strong", "type-body-s-500", item.title || messages.product || "Product"));
      if (item.variantTitle) copy.append(createNode("span", "type-body-xs", item.variantTitle));
      copy.append(createNode("b", "type-body-s-500", formatCartMoney(item.total ?? item.unitPrice, cart.currencyCode)));

      const controls = createNode("div", "cart-item__actions");
      const quantity = createNode("div", "cart-quantity");
      const minus = createNode("button", "type-body-s-500", "−") as HTMLButtonElement;
      minus.type = "button";
      minus.dataset.cartQuantity = String(Math.max(1, Number(item.quantity) - 1));
      minus.setAttribute("aria-label", `${messages.decreaseQuantity || "Decrease"}: ${item.title || messages.product}`);
      minus.disabled = Number(item.quantity) <= 1;

      const amount = createNode("span", "type-body-s-500", String(item.quantity));
      const plus = createNode("button", "type-body-s-500", "+") as HTMLButtonElement;
      plus.type = "button";
      plus.dataset.cartQuantity = String(Number(item.quantity) + 1);
      plus.setAttribute("aria-label", `${messages.increaseQuantity || "Increase"}: ${item.title || messages.product}`);

      quantity.append(minus, amount, plus);
      const remove = createNode("button", "cart-remove type-body-xs", messages.remove || "Remove") as HTMLButtonElement;
      remove.type = "button";
      remove.dataset.cartRemove = "";
      remove.setAttribute("aria-label", `${messages.remove || "Remove"}: ${item.title || messages.product}`);

      controls.append(quantity, remove);
      article.append(media, copy, controls);
      itemsRoot.append(article);
    }

    drawerFooter.hidden = false;
    const subtotal = drawerFooter.querySelector<HTMLElement>("[data-cart-subtotal]");
    const total = drawerFooter.querySelector<HTMLElement>("[data-cart-total]");
    if (subtotal) subtotal.textContent = formatCartMoney(cart.itemTotal, cart.currencyCode);
    if (total) total.textContent = formatCartMoney(cart.total, cart.currencyCode);
  };

  const openCart = async (cartData?: any) => {
    if (!drawer || !backdrop) return;
    setHeaderSurface(null);
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    drawer.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      drawer.dataset.open = "";
      backdrop.dataset.open = "";
    });
    document.body.dataset.cartOpen = "";
    syncPageScrollLock();
    if (cartData) {
      renderDrawerCart(cartData);
    } else {
      const current = $cart.get();
      if (current) renderDrawerCart(current);
      else void fetchCart();
    }
    closeButton?.focus();
  };

  const closeCart = () => {
    if (!drawer || !backdrop) return;
    delete drawer.dataset.open;
    delete backdrop.dataset.open;
    delete document.body.dataset.cartOpen;
    $cartDrawerOpen.set(false);
    syncPageScrollLock();
    setTimeout(() => {
      drawer.hidden = true;
      backdrop.hidden = true;
    }, 260);
    lastFocused?.focus();
  };

  trigger?.addEventListener("click", (event) => {
    if (readOnlyPreview || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void openCart();
  });

  closeButton?.addEventListener("click", closeCart);
  continueButton?.addEventListener("click", closeCart);
  backdrop?.addEventListener("click", closeCart);

  drawer?.addEventListener("click", async (event) => {
    if (readOnlyPreview) return;
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest<HTMLElement>("[data-line-item-id]");
    if (!item) return;
    const quantityButton = target?.closest<HTMLButtonElement>("[data-cart-quantity]");
    const removeButton = target?.closest<HTMLButtonElement>("[data-cart-remove]");
    if (!quantityButton && !removeButton) return;

    const lineItemId = item.dataset.lineItemId || "";
    if (!lineItemId) return;

    if (quantityButton) {
      const qty = Number(quantityButton.dataset.cartQuantity || "1");
      await updateCartItemQuantity(lineItemId, qty);
    } else if (removeButton) {
      await removeCartItem(lineItemId);
    }
  });

  drawer?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCart();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...drawer.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  $cart.subscribe((cart) => {
    if (!readOnlyPreview && cart) {
      renderDrawerCart(cart);
    }
  });

  $cartDrawerOpen.subscribe((isOpen) => {
    if (isOpen && !drawer?.hasAttribute("data-open")) {
      void openCart();
    }
  });

  // Global Add to Cart on product cards
  document.addEventListener("submit", async (event) => {
    const form =
      event.target instanceof HTMLFormElement
        ? event.target.closest<HTMLFormElement>("[data-card-add-form]")
        : null;
    if (!form || event.defaultPrevented || readOnlyPreview) return;
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const label = form.querySelector<HTMLElement>("[data-card-add-label]");
    if (!button || button.disabled) return;
    const originalLabel = label?.textContent ?? messages.addToCart ?? "Add to Cart";
    button.disabled = true;
    if (label) label.textContent = messages.adding ?? "Adding...";

    const result = await addToCart({ form, openDrawer: true });
    if (result.ok) {
      if (label) label.textContent = messages.added ?? "Added!";
    } else {
      if (label) label.textContent = messages.retry ?? "Retry";
    }

    window.setTimeout(() => {
      button.disabled = false;
      if (label) label.textContent = originalLabel;
    }, 1200);
  });

  if (demoPreview) {
    const containPreviewNavigation = (event: Event) => {
      const anchor =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a") : null;
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      const internalDemoRoot = "/demo/storefront/luvia";
      const demoRoot =
        window.location.pathname === "/luvia" || window.location.pathname.startsWith("/luvia/")
          ? "/luvia"
          : internalDemoRoot;
      const route = url.pathname.startsWith(internalDemoRoot)
        ? `${demoRoot}${url.pathname.slice(internalDemoRoot.length)}${url.search}`
        : demoRoot === "/luvia" &&
            (url.pathname === "/luvia" || url.pathname.startsWith("/luvia/"))
          ? `${url.pathname}${url.search}`
          : url.pathname === "/"
            ? demoRoot
            : url.pathname === "/products"
              ? `${demoRoot}/products${url.search}`
              : url.pathname.startsWith("/products/")
                ? `${demoRoot}${url.pathname}`
                : url.pathname === "/cart" || url.pathname === "/checkout"
                  ? `${demoRoot}${url.pathname}`
                  : null;
      if (route) window.location.assign(route);
    };
    document.addEventListener("click", containPreviewNavigation, { capture: true });
    document.addEventListener("auxclick", containPreviewNavigation, { capture: true });
    document.addEventListener("submit", (event) => event.preventDefault(), { capture: true });
  }

  if (!readOnlyPreview) {
    initCartStore();
    void initWishlistStore();
  }
}

/**
 * Initializes dedicated Cart page interactions.
 */
export function initLuviaCartPage() {
  const root = document.querySelector<HTMLElement>("[data-cart-page]");
  if (!root) return;

  initCartStore();
  const messages = getClientMessages();

  const syncCartPageUI = (cart: any) => {
    if (!cart) return;
    const items = Array.isArray(cart.items) ? cart.items : [];
    const count = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

    root.querySelectorAll<HTMLElement>("[data-cart-line]").forEach((line) => {
      const item = items.find((candidate: any) => candidate.id === line.dataset.cartLine);
      if (!item) {
        line.remove();
        return;
      }
      const qty = line.querySelector<HTMLElement>("[data-line-quantity]");
      const total = line.querySelector<HTMLElement>("[data-line-total]");
      if (qty) qty.textContent = String(item.quantity);
      if (total) total.textContent = formatCartMoney(item.total ?? item.unitPrice, cart.currencyCode);

      const forms = [...line.querySelectorAll<HTMLFormElement>('form[action="/actions/cart/update"]')];
      const decrease = forms[0]?.querySelector<HTMLInputElement>('input[name="quantity"]');
      const increase = forms[1]?.querySelector<HTMLInputElement>('input[name="quantity"]');
      if (decrease) decrease.value = String(Math.max(1, item.quantity - 1));
      if (increase) increase.value = String(item.quantity + 1);
      const decreaseButton = forms[0]?.querySelector<HTMLButtonElement>("button");
      if (decreaseButton) decreaseButton.disabled = item.quantity <= 1;
    });

    const pageCount = root.querySelector<HTMLElement>("[data-page-item-count]");
    const summaryCount = root.querySelector<HTMLElement>("[data-summary-count]");
    const countLabel = `${count} ${count === 1 ? "item" : "items"}`;
    if (pageCount) pageCount.textContent = countLabel;
    if (summaryCount) summaryCount.textContent = countLabel;

    const total = root.querySelector<HTMLElement>("[data-summary-total]");
    const shipping = root.querySelector<HTMLElement>("[data-summary-shipping]");
    const discountRow = root.querySelector<HTMLElement>("[data-summary-discount]");
    const discountValue = root.querySelector<HTMLElement>("[data-summary-discount-value]");
    const savings = Math.max(
      0,
      cart.discountTotal != null
        ? Number(cart.discountTotal)
        : Number(cart.itemDiscountTotal || 0) + Number(cart.shippingDiscountTotal || 0),
    );

    if (total) total.textContent = formatCartMoney(cart.total ?? cart.itemTotal, cart.currencyCode);
    if (shipping) {
      shipping.textContent =
        cart.shippingTotal > 0
          ? formatCartMoney(cart.shippingTotal, cart.currencyCode)
          : messages.deliveryAtCheckout || "Calculated at next step";
    }
    if (discountRow) discountRow.hidden = savings <= 0;
    if (discountValue) discountValue.textContent = `−${formatCartMoney(savings, cart.currencyCode)}`;

    if (!items.length) {
      const layout = root.querySelector("[data-cart-page-layout]");
      layout?.remove();
      const empty = document.createElement("section");
      empty.className = "cart-page__empty empty-state container";
      empty.innerHTML = `
        <span class="empty-state__mark">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
        </span>
        <div class="empty-state__copy">
          <h2 class="empty-state__title type-heading-3">${messages.cartEmpty || "Your cart is empty"}</h2>
          <p class="empty-state__text type-body-400">${messages.cartEmptyHelp || "Add pieces from the shop to start your order."}</p>
        </div>
        <a class="empty-state__action type-body-500" href="/products">${messages.browseProducts || "Browse products"}</a>
      `;
      root.append(empty);
    }
  };

  $cart.subscribe((cart) => {
    if (cart) syncCartPageUI(cart);
  });

  root.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("[data-cart-page-form],[data-cart-promotion-form]")) return;
    event.preventDefault();

    const formData = new FormData(form);
    const isPromotion = form.matches("[data-cart-promotion-form]");

    if (isPromotion) {
      const intent = (formData.get("intent")?.toString() || "apply") as "apply" | "remove";
      const code = formData.get("code")?.toString() || "";
      if (code) {
        await applyPromotion(code, intent);
        if (intent !== "remove") form.reset();
      }
      return;
    }

    const lineItemId = formData.get("lineItemId")?.toString();
    if (!lineItemId) return;

    if (form.action.endsWith("/remove")) {
      await removeCartItem(lineItemId);
    } else if (form.action.endsWith("/update")) {
      const quantity = Number(formData.get("quantity") || 1);
      await updateCartItemQuantity(lineItemId, quantity);
    }
  });
}

/**
 * Initializes Product detail page options, gallery, accordions, and add-to-cart.
 */
export function initLuviaProductPage() {
  const root = document.querySelector<HTMLElement>("[data-product-root]");
  if (!root) return;

  const messages = getClientMessages();
  const variantsData = root.querySelector<HTMLScriptElement>("[data-variants-data]");
  const variants: any[] = variantsData?.textContent ? JSON.parse(variantsData.textContent) : [];

  const selected: Record<string, string> = {};
  root.querySelectorAll<HTMLButtonElement>("[data-option-title][data-selected]").forEach((btn) => {
    const title = btn.dataset.optionTitle;
    const value = btn.dataset.optionValue;
    if (title && value) selected[title] = value;
  });

  const selectedVariant = () =>
    variants.find((v) =>
      Object.entries(selected).every(
        ([title, val]) => v.options?.[title] === val || v.options?.[title.toLowerCase()] === val,
      ),
    ) ?? variants[0];

  const refreshVariant = () => {
    const variant = selectedVariant();
    if (!variant) return;

    const variantInput = root.querySelector<HTMLInputElement>('input[name="variantId"]');
    if (variantInput) variantInput.value = variant.id;

    const price = root.querySelector<HTMLElement>("[data-product-price]");
    if (price) price.textContent = formatCartMoney(variant.price, variant.currencyCode);

    root.querySelectorAll<HTMLButtonElement>("[data-option-title]").forEach((btn) => {
      const isSelected = selected[btn.dataset.optionTitle || ""] === btn.dataset.optionValue;
      btn.toggleAttribute("data-selected", isSelected);
      btn.setAttribute("aria-pressed", String(isSelected));
    });

    const mainImg = root.querySelector<HTMLImageElement>("[data-gallery-main] img");
    if (mainImg && variant.imageUrl) {
      mainImg.src = variant.imageUrl;
    }
  };

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const option = target?.closest<HTMLButtonElement>("[data-option-title]");
    if (option && !option.disabled && option.dataset.optionTitle && option.dataset.optionValue) {
      selected[option.dataset.optionTitle] = option.dataset.optionValue;
      refreshVariant();
    }

    const thumb = target?.closest<HTMLButtonElement>("[data-gallery-thumb]");
    if (thumb) {
      const main = root.querySelector<HTMLImageElement>("[data-gallery-main] img");
      if (main && thumb.dataset.galleryThumb) {
        main.src = thumb.dataset.galleryThumb;
        if (thumb.dataset.galleryThumbSrcset) {
          main.srcset = thumb.dataset.galleryThumbSrcset;
        } else {
          main.removeAttribute("srcset");
        }
      }
      root.querySelectorAll("[data-gallery-thumb]").forEach((item) => item.removeAttribute("aria-current"));
      thumb.setAttribute("aria-current", "true");
    }
  });

  // Animated accordions
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  root.querySelectorAll(".product-accordions details").forEach((disclosure) => {
    if (!(disclosure instanceof HTMLDetailsElement)) return;
    const summary = disclosure.querySelector("summary");
    if (!summary) return;
    let animation: Animation | undefined;
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      animation?.cancel();
      if (reducedMotion.matches) {
        disclosure.open = !disclosure.open;
        return;
      }
      const opening = !disclosure.open;
      const startHeight = disclosure.offsetHeight;
      disclosure.style.overflow = "hidden";
      if (opening) disclosure.open = true;
      const styles = getComputedStyle(disclosure);
      const collapsedHeight =
        summary.offsetHeight +
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom) +
        Number.parseFloat(styles.borderTopWidth) +
        Number.parseFloat(styles.borderBottomWidth);
      const endHeight = opening ? disclosure.scrollHeight : collapsedHeight;
      animation = disclosure.animate(
        { height: [`${startHeight}px`, `${endHeight}px`] },
        { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" },
      );
      const content = disclosure.querySelector(":scope > div");
      if (opening) {
        content?.animate(
          { opacity: [0, 1], transform: ["translateY(-5px)", "translateY(0)"] },
          { duration: 180, easing: "cubic-bezier(.22,1,.36,1)" },
        );
      }
      animation.addEventListener(
        "finish",
        () => {
          if (!opening) disclosure.open = false;
          disclosure.style.removeProperty("overflow");
          animation = undefined;
        },
        { once: true },
      );
    });
  });

  // Product Add to Cart Form
  const form = root.querySelector<HTMLFormElement>("[data-add-form]");
  const addButton = root.querySelector<HTMLButtonElement>("[data-add-button]");
  const stickyAdd = root.querySelector<HTMLButtonElement>("[data-sticky-add]");
  const feedback = root.querySelector<HTMLElement>("[data-add-feedback]");

  const updateButtons = (loading: boolean, text: string) => {
    [addButton, stickyAdd].forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = loading;
      btn.dataset.loading = loading ? "true" : "false";
      const label = btn.querySelector("[data-add-label]");
      if (label) label.textContent = text;
    });
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form || !addButton || addButton.disabled) return;
    updateButtons(true, messages.adding || "Adding...");
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("is-error");
    }

    const result = await addToCart({ form, openDrawer: true });
    if (result.ok) {
      updateButtons(true, messages.added || "Added!");
      setTimeout(() => {
        const inStock = Boolean(selectedVariant()?.inStock);
        updateButtons(!inStock, inStock ? messages.addToCart || "Add to Cart" : messages.outOfStock || "Out of Stock");
      }, 1400);
    } else {
      updateButtons(!selectedVariant()?.inStock, messages.addToCart || "Add to Cart");
      if (feedback) {
        feedback.textContent = result.error || messages.addFailed || "Failed to add to cart";
        feedback.classList.add("is-error");
      }
    }
  });

  stickyAdd?.addEventListener("click", () => {
    if (form) form.requestSubmit();
  });

  // Related products carousel buttons
  const rail = document.querySelector<HTMLElement>("[data-related-rail]");
  document.querySelector("[data-related-prev]")?.addEventListener("click", () => {
    rail?.scrollBy({ left: -Math.max(280, (rail.clientWidth || 300) * 0.75), behavior: "smooth" });
  });
  document.querySelector("[data-related-next]")?.addEventListener("click", () => {
    rail?.scrollBy({ left: Math.max(280, (rail.clientWidth || 300) * 0.75), behavior: "smooth" });
  });

  // Sticky product bottom bar intersection
  const stickyProduct = root.querySelector<HTMLElement>("[data-sticky-product]");
  const inquiry = document.querySelector(".inquiry");
  if (stickyProduct && inquiry && "IntersectionObserver" in window) {
    const inquiryObserver = new IntersectionObserver(
      ([entry]) => {
        stickyProduct.toggleAttribute("data-hidden", Boolean(entry?.isIntersecting));
      },
      { threshold: 0.05 },
    );
    inquiryObserver.observe(inquiry);
  }

  refreshVariant();
}
