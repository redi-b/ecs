import { setCartCount as syncCartCount } from "../../../../lib/browser/cart-count";
import { initProductSearchSuggestions } from "../../../../lib/browser/product-search-suggestions";
import { initStorefrontRuntime } from "../../../../lib/browser/storefront-runtime";
import {
  $cart,
  $cartDrawerOpen,
  $isCartMutating,
  addToCart,
  applyPromotion,
  fetchCart,
  initCartStore,
  removeCartItem,
  updateCartItemQuantity,
} from "../../../../lib/stores/cart";
import { cleanVariantTitle } from "../../../../lib/commerce/normalize";
import { initHeroCarousels } from "./hero-carousel";

function getClientMessages(): Record<string, string> {
  try {
    return JSON.parse(document.body.dataset.clientMessages || "{}");
  } catch {
    return {};
  }
}

function formatCartMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
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

  initCartStore();
  initLuviaHome();

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
      headerBackdrop.setAttribute(
        "aria-label",
        surface === "menu" ? "Close navigation" : "Close search",
      );
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

  const isSearchCollapsed = () => {
    if (!searchInput) return false;
    const style = window.getComputedStyle(searchInput);
    return style.position === "absolute" && style.visibility === "hidden";
  };

  searchButton?.addEventListener("click", (event) => {
    if (isSearchCollapsed() && headerSurface !== "search") {
      event.preventDefault();
      setHeaderSurface("search");
    }
  });

  searchForm?.addEventListener("submit", (event) => {
    if (searchInput?.value.trim()) return;
    if (isSearchCollapsed()) {
      event.preventDefault();
      setHeaderSurface("search");
      searchInput?.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !headerSurface) return;
    event.preventDefault();
    setHeaderSurface(null, true);
  });

  window.matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
    if (event.matches && headerSurface === "menu") setHeaderSurface(null);
  });

  // The header is pinned, so page content eventually scrolls under the pill.
  // Deepen its edge once that happens. Read work is coalesced to one frame.
  const header = document.querySelector<HTMLElement>(".header");
  if (header) {
    let headerFrame = 0;
    const syncHeaderState = () => {
      headerFrame = 0;
      header.toggleAttribute("data-scrolled", window.scrollY > 8);
    };
    window.addEventListener(
      "scroll",
      () => {
        if (headerFrame) return;
        headerFrame = window.requestAnimationFrame(syncHeaderState);
      },
      { passive: true },
    );
    syncHeaderState();
  }

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

  // data-cart-status is a declared aria-live region; nothing ever wrote to it,
  // so no cart mutation was ever announced to screen readers.
  const announce = (message?: string) => {
    const status = document.querySelector<HTMLElement>("[data-cart-status]");
    if (status && message) status.textContent = message;
  };

  const renderDrawerCart = (cart: any) => {
    if (!itemsRoot || !drawerFooter) return;
    // The list is rebuilt wholesale on every mutation, which destroys the button
    // the user just pressed and drops focus to <body> — taking the focus trap
    // with it. Remember which control had focus and put it back afterwards.
    const active = document.activeElement as HTMLElement | null;
    const focusKey =
      active && itemsRoot.contains(active)
        ? {
            lineId: active.closest<HTMLElement>("[data-line-item-id]")?.dataset.lineItemId,
            action: active.dataset.cartAction,
          }
        : null;
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
        createNode(
          "h3",
          "empty-state__title type-heading-3",
          messages.cartEmpty || "Your cart is empty",
        ),
        createNode(
          "p",
          "empty-state__text type-body-400",
          messages.cartEmptyHelp || "Add pieces to start your order.",
        ),
      );
      const shop = createNode(
        "a",
        "empty-state__action type-body-500",
        messages.continueShopping || "Continue shopping",
      );
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
      media.href = item.productHandle
        ? `/products/${encodeURIComponent(item.productHandle)}`
        : "/products";
      const itemMedia = item.imageUrl || item.thumbnail;
      if (itemMedia) {
        const img = createNode("img") as HTMLImageElement;
        img.src = itemMedia;
        img.alt = "";
        media.append(img);
      }

      const copy = createNode("div", "cart-item__copy");
      const titleText = item.title || messages.product || "Product";
      copy.append(
        createNode("strong", "type-body-s-500", titleText),
      );
      const cleanVariant = cleanVariantTitle(item.variantTitle, titleText);
      if (cleanVariant) copy.append(createNode("span", "type-body-xs", cleanVariant));
      copy.append(
        createNode(
          "b",
          "type-body-s-500",
          formatCartMoney(item.total ?? item.unitPrice, cart.currencyCode),
        ),
      );

      const controls = createNode("div", "cart-item__actions");
      const quantity = createNode("div", "cart-quantity");
      const minus = createNode("button", "type-body-s-500", "−") as HTMLButtonElement;
      minus.type = "button";
      minus.dataset.cartAction = "dec";
      minus.dataset.cartQuantity = String(Math.max(1, Number(item.quantity) - 1));
      minus.setAttribute(
        "aria-label",
        `${messages.decreaseQuantity || "Decrease"}: ${item.title || messages.product}`,
      );
      minus.disabled = Number(item.quantity) <= 1;

      const amount = createNode("span", "type-body-s-500", String(item.quantity));
      const plus = createNode("button", "type-body-s-500", "+") as HTMLButtonElement;
      plus.type = "button";
      plus.dataset.cartAction = "inc";
      plus.dataset.cartQuantity = String(Number(item.quantity) + 1);
      plus.setAttribute(
        "aria-label",
        `${messages.increaseQuantity || "Increase"}: ${item.title || messages.product}`,
      );

      quantity.append(minus, amount, plus);
      const remove = createNode(
        "button",
        "cart-remove type-body-xs",
        messages.remove || "Remove",
      ) as HTMLButtonElement;
      remove.type = "button";
      remove.dataset.cartAction = "remove";
      remove.dataset.cartRemove = "";
      remove.setAttribute(
        "aria-label",
        `${messages.remove || "Remove"}: ${item.title || messages.product}`,
      );

      controls.append(quantity, remove);
      article.append(media, copy, controls);
      itemsRoot.append(article);
    }

    drawerFooter.hidden = false;
    const subtotal = drawerFooter.querySelector<HTMLElement>("[data-cart-subtotal]");
    const total = drawerFooter.querySelector<HTMLElement>("[data-cart-total]");
    if (subtotal) subtotal.textContent = formatCartMoney(cart.itemTotal, cart.currencyCode);
    if (total) total.textContent = formatCartMoney(cart.total, cart.currencyCode);

    if (focusKey?.lineId && focusKey.action) {
      const restored = itemsRoot.querySelector<HTMLElement>(
        `[data-line-item-id="${CSS.escape(focusKey.lineId)}"] [data-cart-action="${focusKey.action}"]`,
      );
      if (restored && !restored.hasAttribute("disabled")) restored.focus();
    }
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
      // Restore focus only once the drawer is actually out of the tab order,
      // otherwise Tab can land inside a drawer that is about to be hidden.
      lastFocused?.focus();
    }, 260);
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
      // Only rebuild the closed drawer on demand. Every page mounts this
      // module, so an unguarded rebuild cost a full list re-render per
      // mutation on pages that never open the drawer.
      if (drawer?.hasAttribute("data-open")) renderDrawerCart(cart);
    }
  });

  $isCartMutating.subscribe((isMutating) => {
    if (drawer) {
      drawer.toggleAttribute("data-mutating", isMutating);
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
    if (!button || button.disabled) return;
    button.disabled = true;
    button.classList.add("is-bump");

    await addToCart({ form, openDrawer: true });

    button.disabled = false;
    button.classList.remove("is-bump");
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
        : demoRoot === "/luvia" && (url.pathname === "/luvia" || url.pathname.startsWith("/luvia/"))
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
    initStorefrontRuntime();
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
      if (qty) {
        qty.textContent = String(item.quantity);
        qty.classList.remove("is-tick");
        void qty.offsetWidth;
        qty.classList.add("is-tick");
      }
      if (total)
        total.textContent = formatCartMoney(item.total ?? item.unitPrice, cart.currencyCode);

      // Select by intent: forms[0]/forms[1] assumed a DOM order that one extra
      // form would silently break.
      const decrease = line.querySelector<HTMLInputElement>(
        'form[data-qty="dec"] input[name="quantity"]',
      );
      const increase = line.querySelector<HTMLInputElement>(
        'form[data-qty="inc"] input[name="quantity"]',
      );
      if (decrease) decrease.value = String(Math.max(1, item.quantity - 1));
      if (increase) increase.value = String(item.quantity + 1);
      const decreaseButton = line.querySelector<HTMLButtonElement>('form[data-qty="dec"] button');
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
    if (discountValue)
      discountValue.textContent = `−${formatCartMoney(savings, cart.currencyCode)}`;

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

  // Seed from what the server actually rendered as selected. Product.astro
  // emits aria-pressed on the chosen value; reading data-selected instead left
  // `selected` empty, so every swatch lost aria-pressed and the price silently
  // fell back to variants[0].
  const selected: Record<string, string> = {};
  root
    .querySelectorAll<HTMLButtonElement>('[data-option-title][aria-pressed="true"]')
    .forEach((btn) => {
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
    // The payload key is priceAmount (see Product.astro); reading `price` here
    // resolved to undefined and overwrote the server price with an em dash.
    if (price) price.textContent = formatCartMoney(variant.priceAmount, variant.currencyCode);

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
      root.querySelectorAll("[data-gallery-thumb]").forEach((item) => {
        item.removeAttribute("aria-current");
      });
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
    addButton.disabled = true;
    if (stickyAdd) stickyAdd.disabled = true;
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("is-error");
    }

    const result = await addToCart({ form, openDrawer: true });
    const inStock = Boolean(selectedVariant()?.inStock);
    [addButton, stickyAdd].forEach((btn) => {
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = !inStock;
      }
    });

    if (!result.ok && feedback) {
      feedback.textContent = result.error || messages.addFailed || "Failed to add to cart";
      feedback.classList.add("is-error");
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

/**
 * Home page: hero carousel + the horizontally scrolling product rail.
 *
 * This used to live in a `<script>` at the bottom of index.astro, which Astro
 * never collected into a client bundle, so none of it ran. client.ts is
 * imported by the layout entry, so it ships on every page; the rail guard keeps
 * it a no-op everywhere else.
 */
export function initLuviaHome() {
  const rail = document.querySelector<HTMLElement>("[data-product-rail]");
  const previous = document.querySelector<HTMLButtonElement>("[data-product-rail-prev]");
  const next = document.querySelector<HTMLButtonElement>("[data-product-rail-next]");

  if (rail && previous && next) {
    initHeroCarousels();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const updateRailControls = () => {
      frame = 0;
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      previous.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max - 2;
    };
    // Coalesce to one read/write per frame instead of per scroll event.
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateRailControls);
    };
    const moveRail = (direction: -1 | 1) => {
      const card = rail.querySelector<HTMLElement>(".product-card");
      const distance = Math.max(
        card?.offsetWidth ?? rail.clientWidth * 0.75,
        rail.clientWidth * 0.72,
      );
      rail.scrollBy({
        left: distance * direction,
        behavior: prefersReducedMotion.matches ? "auto" : "smooth",
      });
    };

    previous.addEventListener("click", () => moveRail(-1));
    next.addEventListener("click", () => moveRail(1));
    rail.addEventListener("scroll", onScroll, { passive: true });
    rail.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        moveRail(event.key === "ArrowLeft" ? -1 : 1);
      }
    });
    new ResizeObserver(onScroll).observe(rail);
    updateRailControls();
  }

  // Initialize dropdowns and home product filters
  initLuviaDropdowns();
  initLuviaHomeFilters();
}

// ---------------------------------------------------------------------------
// Reusable Dropdown – mirrors Dropdown.astro markup
// ---------------------------------------------------------------------------
export function initLuviaDropdowns(root: ParentNode = document) {
  const dropdowns = root.querySelectorAll<HTMLElement>("[data-dropdown]");

  dropdowns.forEach((dropdown) => {
    if (dropdown.dataset.dropdownReady === "true") return;
    dropdown.dataset.dropdownReady = "true";

    const trigger = dropdown.querySelector<HTMLButtonElement>(".luvia-dropdown__trigger");
    const menu = dropdown.querySelector<HTMLElement>(".luvia-dropdown__menu");
    const label = dropdown.querySelector<HTMLElement>("[data-dropdown-label]");
    const options = Array.from(
      dropdown.querySelectorAll<HTMLButtonElement>(".luvia-dropdown__option"),
    );
    if (!trigger || !menu || options.length === 0) return;

    const selected =
      options.find((opt) => opt.getAttribute("aria-selected") === "true") ?? options[0];
    dropdown.dataset.value = selected.dataset.value ?? "";
    if (label) label.textContent = selected.textContent?.trim() ?? "";

    function close() {
      trigger?.setAttribute("aria-expanded", "false");
      if (menu) menu.hidden = true;
    }

    function open() {
      // Close all other dropdowns first
      document.querySelectorAll<HTMLElement>("[data-dropdown]").forEach((other) => {
        if (other === dropdown) return;
        other.querySelector(".luvia-dropdown__trigger")?.setAttribute("aria-expanded", "false");
        const otherMenu = other.querySelector<HTMLElement>(".luvia-dropdown__menu");
        if (otherMenu) otherMenu.hidden = true;
      });
      trigger?.setAttribute("aria-expanded", "true");
      if (menu) menu.hidden = false;
    }

    function setValue(value: string, text: string, silent = false) {
      dropdown.dataset.value = value;
      if (label) label.textContent = text;
      options.forEach((opt) => {
        opt.setAttribute("aria-selected", String(opt.dataset.value === value));
      });
      if (!silent) {
        dropdown.dispatchEvent(
          new CustomEvent("dropdown:change", { bubbles: true, detail: { value } }),
        );
      }
    }

    trigger.addEventListener("click", () => {
      if (trigger.getAttribute("aria-expanded") === "true") close();
      else open();
    });

    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        setValue(opt.dataset.value ?? "", opt.textContent?.trim() ?? "");
        close();
      });
    });

    // Programmatic set (for clear button)
    dropdown.addEventListener("dropdown:set", ((event: Event) => {
      const value = (event as CustomEvent<{ value: string }>).detail?.value;
      const match = options.find((opt) => opt.dataset.value === value);
      if (!match) return;
      setValue(value, match.textContent?.trim() ?? "", true);
      close();
    }) as EventListener);

    // Close on outside click
    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target as Node)) close();
    });

    // Close on Escape
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  });
}

// ---------------------------------------------------------------------------
// Home Product Filters — client-side filtering, sorting, price range
// ---------------------------------------------------------------------------
export function initLuviaHomeFilters() {
  const grid = document.getElementById("luvia-product-grid");
  if (!grid) return;
  const productGrid = grid;

  const cards = Array.from(productGrid.querySelectorAll<HTMLElement>(".product-card"));
  const initialIndexMap = new Map(cards.map((card, i) => [card, i]));
  const countEl = document.getElementById("luvia-filter-count");
  const categoryMenu = document.getElementById("luvia-filter-category");
  const collectionMenu = document.getElementById("luvia-filter-collection");
  const sortMenu = document.getElementById("luvia-filter-sort");
  const searchLink = document.getElementById("luvia-filter-search") as HTMLAnchorElement | null;
  const minInput = document.getElementById("luvia-price-min") as HTMLInputElement | null;
  const maxInput = document.getElementById("luvia-price-max") as HTMLInputElement | null;
  const clearBtn = document.getElementById("luvia-clear-filters");

  const MAX_PRICE = 100000;
  const DEFAULT_SHOWN = 12;

  const state = {
    category: "all",
    collection: "all",
    sort: "created_at",
    min: 0,
    max: MAX_PRICE,
  };

  function parsePrice(card: HTMLElement): number {
    const text = card.querySelector(".product-card__price")?.textContent || "0";
    return parseFloat(text.replace(/[^0-9.]/g, "")) || 0;
  }

  function isDefault(): boolean {
    return (
      state.category === "all" &&
      state.collection === "all" &&
      state.sort === "created_at" &&
      state.min <= 0 &&
      state.max >= MAX_PRICE
    );
  }

  function updateSearchUrl() {
    if (!searchLink) return;
    const params = new URLSearchParams();
    if (state.category && state.category !== "all") {
      params.set("category", state.category);
    }
    if (state.collection && state.collection !== "all") {
      params.set("collection", state.collection);
    }
    if (state.min > 0) {
      params.set("price_min", String(state.min));
    }
    if (state.max < MAX_PRICE) {
      params.set("price_max", String(state.max));
    }
    if (state.sort && state.sort !== "created_at") {
      if (state.sort === "price-low") params.set("order", "price");
      else if (state.sort === "price-high") params.set("order", "-price");
      else if (state.sort === "title") params.set("order", "title");
    }
    searchLink.href = params.size ? `/products?${params.toString()}` : "/products";
  }

  function apply() {
    const matches = cards.filter((card) => {
      const category = (card.dataset.category || "").toLowerCase();
      const collection = (card.dataset.collection || "").toLowerCase();

      if (state.category !== "all" && !category.includes(state.category.toLowerCase()))
        return false;
      if (state.collection !== "all" && !collection.includes(state.collection.toLowerCase()))
        return false;

      const price = parsePrice(card);
      if (price < state.min || price > state.max) return false;
      return true;
    });

    // Sort
    if (state.sort === "price-low") {
      matches.sort((a, b) => parsePrice(a) - parsePrice(b));
    } else if (state.sort === "price-high") {
      matches.sort((a, b) => parsePrice(b) - parsePrice(a));
    } else if (state.sort === "title") {
      matches.sort((a, b) =>
        (a.querySelector(".product-card__title")?.textContent || "").localeCompare(
          b.querySelector(".product-card__title")?.textContent || "",
        ),
      );
    } else if (state.sort === "created_at") {
      matches.sort((a, b) => (initialIndexMap.get(a) ?? 0) - (initialIndexMap.get(b) ?? 0));
    }

    // When no filters active, only show the default count
    const visible = isDefault() ? matches.slice(0, DEFAULT_SHOWN) : matches;

    // Hide all, then show matched in sort order
    cards.forEach((card) => {
      card.classList.add("is-deferred");
    });
    visible.forEach((card) => {
      card.classList.remove("is-deferred");
      productGrid.appendChild(card); // re-appending reorders the DOM
    });

    if (countEl) {
      const template = countEl.dataset.template;
      if (template) {
        countEl.textContent = template
          .replace("{shown}", String(visible.length))
          .replace("{total}", String(cards.length));
      } else {
        countEl.textContent = `Showing ${visible.length} of ${cards.length} products`;
      }
    }

    updateSearchUrl();
  }

  // Event listeners for dropdowns
  categoryMenu?.addEventListener("dropdown:change", (event) => {
    state.category = (event as CustomEvent<{ value: string }>).detail.value;
    apply();
  });

  collectionMenu?.addEventListener("dropdown:change", (event) => {
    state.collection = (event as CustomEvent<{ value: string }>).detail.value;
    apply();
  });

  sortMenu?.addEventListener("dropdown:change", (event) => {
    state.sort = (event as CustomEvent<{ value: string }>).detail.value;
    apply();
  });

  // Price inputs
  function readPrice(input: HTMLInputElement | null, fallback: number): number {
    if (!input || input.value.trim() === "") return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? Math.max(0, Math.min(MAX_PRICE, value)) : fallback;
  }

  function onPriceChange() {
    state.min = readPrice(minInput, 0);
    state.max = readPrice(maxInput, MAX_PRICE);
    if (state.min > state.max) state.max = state.min;
    apply();
  }

  minInput?.addEventListener("change", onPriceChange);
  maxInput?.addEventListener("change", onPriceChange);

  // Clear button
  clearBtn?.addEventListener("click", () => {
    state.category = "all";
    state.collection = "all";
    state.sort = "created_at";
    state.min = 0;
    state.max = MAX_PRICE;
    if (minInput) minInput.value = "";
    if (maxInput) maxInput.value = "";
    categoryMenu?.dispatchEvent(new CustomEvent("dropdown:set", { detail: { value: "all" } }));
    collectionMenu?.dispatchEvent(new CustomEvent("dropdown:set", { detail: { value: "all" } }));
    sortMenu?.dispatchEvent(new CustomEvent("dropdown:set", { detail: { value: "created_at" } }));
    apply();
  });

  updateSearchUrl();
}
