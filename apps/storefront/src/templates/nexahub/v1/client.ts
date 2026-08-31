import { loadAndSyncCartCount, setCartCount as syncCartCount } from "../../../lib/browser/cart-count";
import { initWishlistController } from "../../../lib/browser/wishlist";
import EmblaCarousel from "embla-carousel";

export function initNexahubStorefront() {
  const readOnly = document.body.dataset.editorMode === "true" || document.body.dataset.demoMode === "true";
  const header = document.querySelector<HTMLElement>(".site-header");
  const menu = header?.querySelector<HTMLButtonElement>(".site-header__toggle");
  const nav = header?.querySelector<HTMLElement>(".site-header__nav");
  const dropdownButton = header?.querySelector<HTMLButtonElement>("[data-header-dropdown-btn]");
  const dropdown = header?.querySelector<HTMLElement>("[data-header-dropdown-menu]");
  const navigationBackdrop = document.querySelector<HTMLButtonElement>("[data-header-backdrop]");
  const overlay = document.querySelector<HTMLElement>("[data-cart-overlay]");
  const drawer = document.querySelector<HTMLElement>("[data-cart-modal]");
  const status = drawer?.querySelector<HTMLElement>("[data-cart-status]");
  const itemsRoot = drawer?.querySelector<HTMLElement>("[data-cart-items]");
  const footer = drawer?.querySelector<HTMLElement>("[data-cart-footer]");
  const drawerCount = drawer?.querySelector<HTMLElement>("[data-cart-drawer-count]");
  const liveRegion = document.querySelector<HTMLElement>("[data-nexa-live]");
  const toast = document.querySelector<HTMLElement>("[data-nexa-toast]");
  let toastTimer = 0;
  let lastFocused: HTMLElement | null = null;
  let navigationLastFocused: HTMLElement | null = null;
  let navigationCloseTimer = 0;
  let lockedScrollY = 0;
  const isCollapsedNavigation = () => window.matchMedia("(max-width: 1100px)").matches;
  const syncScrollLock = () => {
    const locked = Boolean(header?.classList.contains("is-open") || overlay?.classList.contains("is-visible"));
    const alreadyLocked = document.body.classList.contains("no-scroll");
    if (locked && !alreadyLocked) {
      lockedScrollY = window.scrollY;
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.classList.add("no-scroll");
    } else if (!locked && alreadyLocked) {
      document.body.classList.remove("no-scroll");
      document.body.style.removeProperty("top");
      window.scrollTo({ top: lockedScrollY, behavior: "auto" });
    }
  };

  const announce = (message: string) => {
    if (!liveRegion) return;
    liveRegion.textContent = "";
    window.setTimeout(() => { liveRegion.textContent = message; }, 20);
  };
  const showToast = (message: string, tone: "error" | "info" = "error") => {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => { toast.hidden = true; }, 220);
    }, 5000);
  };
  const setBusy = (button: HTMLButtonElement | null | undefined, busy: boolean, busyLabel?: string) => {
    if (!button) return;
    const label = button.querySelector<HTMLElement>("[data-card-add-label], [data-add-label], .btn__text");
    if (busy) {
      button.dataset.busy = "true";
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
      if (label) { label.dataset.idleLabel = label.textContent ?? ""; if (busyLabel) label.textContent = busyLabel; }
      else if (busyLabel && button.childElementCount === 0) { button.dataset.idleText = button.textContent ?? ""; button.textContent = busyLabel; }
    } else {
      delete button.dataset.busy;
      button.removeAttribute("aria-busy");
      button.disabled = false;
      if (label?.dataset.idleLabel != null) { label.textContent = label.dataset.idleLabel; delete label.dataset.idleLabel; }
      if (button.dataset.idleText != null) { button.textContent = button.dataset.idleText; delete button.dataset.idleText; }
    }
  };
  const focusableElements = (root: HTMLElement | null | undefined) => root
    ? [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true")
    : [];
  const closeFilterMenus = (restoreFocus = false) => {
    document.querySelectorAll<HTMLElement>("[data-filter-menu].is-open").forEach((node) => {
      node.classList.remove("is-open");
    });
    document.querySelectorAll<HTMLButtonElement>("[data-filter-toggle]").forEach((node) => {
      const wasOpen = node.getAttribute("aria-expanded") === "true";
      node.setAttribute("aria-expanded", "false");
      if (restoreFocus && wasOpen) node.focus();
    });
  };

  document.querySelectorAll<HTMLElement>("[data-featured-carousel]").forEach((root) => {
    const viewport = root.querySelector<HTMLElement>("[data-featured-viewport]");
    if (!viewport) return;
    const carousel = EmblaCarousel(viewport, { align: "start", loop: root.querySelectorAll(".hero-section__featured-slide").length > 1 });
    const dots = [...root.querySelectorAll<HTMLButtonElement>("[data-featured-dot]")];
    const syncDots = () => dots.forEach((dot, index) => { const active = index === carousel.selectedScrollSnap(); dot.classList.toggle("hero-section__dot--active", active); dot.setAttribute("aria-current", active ? "true" : "false"); });
    dots.forEach((dot, index) => dot.addEventListener("click", () => carousel.scrollTo(index)));
    carousel.on("select", syncDots); syncDots();
  });

  document.querySelectorAll<HTMLElement>(".catalogue-section").forEach((root) => {
    const track = root.querySelector<HTMLElement>(".catalogue-section__grid");
    const previous = root.querySelector<HTMLButtonElement>("[data-cat-prev]");
    const next = root.querySelector<HTMLButtonElement>("[data-cat-next]");
    if (!track || !previous || !next) return;
    const sync = () => {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = max <= 2 || track.scrollLeft >= max - 2;
    };
    previous.addEventListener("click", () => track.scrollBy({ left: -track.clientWidth * 0.72, behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: track.clientWidth * 0.72, behavior: "smooth" }));
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });

  document.querySelectorAll<HTMLFormElement>("[data-filter-bar]").forEach((bar) => {
    bar.querySelectorAll<HTMLElement>(".product-filter-bar__item").forEach((item) => {
      const toggle = item.querySelector<HTMLButtonElement>("[data-filter-toggle]");
      const menu = item.querySelector<HTMLElement>("[data-filter-menu]");
      const selected = item.querySelector<HTMLElement>("[data-filter-selected]");
      const input = item.querySelector<HTMLInputElement>("[data-filter-input]");
      toggle?.addEventListener("click", () => {
        const open = !menu?.classList.contains("is-open");
        closeFilterMenus();
        if (!menu || !open) return;
        menu.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      });
      toggle?.addEventListener("keydown", (event) => { if (event.key === "ArrowDown") { event.preventDefault(); if (!menu?.classList.contains("is-open")) toggle.click(); else menu.querySelector<HTMLButtonElement>("[data-filter-option]")?.focus(); } });
      menu?.querySelectorAll<HTMLButtonElement>("[data-filter-option]").forEach((option) => option.addEventListener("click", () => { if (input) input.value = option.dataset.filterOption ?? ""; if (selected) selected.textContent = option.textContent?.trim() ?? ""; closeFilterMenus(); if (!readOnly) { bar.setAttribute("aria-busy", "true"); announce("Updating products"); bar.requestSubmit(); } }));
    });
  });

  const setNavigation = (open: boolean) => {
    const wasOpen = Boolean(header?.classList.contains("is-open"));
    if (open && !wasOpen) navigationLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : menu ?? null;
    window.clearTimeout(navigationCloseTimer);
    menu?.setAttribute("aria-expanded", String(open));
    menu?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    if (open) {
      header?.classList.remove("is-closing");
      nav?.classList.remove("is-closing");
      navigationBackdrop?.classList.remove("is-closing");
      header?.classList.add("is-open");
      nav?.classList.add("is-open");
      navigationBackdrop?.classList.add("is-visible");
      syncScrollLock();
      window.setTimeout(() => nav?.querySelector<HTMLElement>('a[href], button, input')?.focus(), 30);
      return;
    }
    if (!wasOpen) return;
    header?.classList.add("is-closing");
    nav?.classList.add("is-closing");
    navigationBackdrop?.classList.add("is-closing");
    navigationCloseTimer = window.setTimeout(() => {
      header?.classList.remove("is-open", "is-closing");
      nav?.classList.remove("is-open", "is-closing");
      navigationBackdrop?.classList.remove("is-visible", "is-closing");
      syncScrollLock();
      navigationLastFocused?.focus();
    }, 220);
  };
  const setDropdown = (open: boolean) => {
    dropdown?.classList.toggle("is-open", open);
    dropdownButton?.setAttribute("aria-expanded", String(open));
  };
  menu?.addEventListener("click", () => setNavigation(nav?.classList.contains("is-closing") || !header?.classList.contains("is-open")));
  navigationBackdrop?.addEventListener("click", () => setNavigation(false));
  nav?.addEventListener("click", (event) => {
    if (isCollapsedNavigation() && event.target instanceof Element && event.target.closest("a[href]")) setNavigation(false);
  });
  dropdownButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    setDropdown(!dropdown?.classList.contains("is-open"));
  });
  dropdownButton?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setDropdown(true); window.setTimeout(() => dropdown?.querySelector<HTMLAnchorElement>("a")?.focus(), 0); }
  });
  dropdown?.addEventListener("keydown", (event) => {
    const links = [...dropdown.querySelectorAll<HTMLAnchorElement>("a")];
    const index = event.target instanceof HTMLElement ? links.indexOf(event.target as HTMLAnchorElement) : -1;
    if (index < 0 || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? (index + 1) % links.length : event.key === "ArrowUp" ? (index - 1 + links.length) % links.length : event.key === "Home" ? 0 : links.length - 1;
    links[next]?.focus();
  });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(".site-header__nav-item--dropdown")) setDropdown(false);
    const activeMenu = document.querySelector<HTMLElement>("[data-filter-menu].is-open");
    const activeOwner = activeMenu?.closest<HTMLElement>(".product-filter-bar__item");
    const insideActiveFilter = Boolean(activeMenu && (activeMenu.contains(target) || activeOwner?.contains(target)));
    if (activeMenu && !insideActiveFilter) closeFilterMenus();
  });
  window.addEventListener("resize", () => {
    if (!isCollapsedNavigation()) {
      setNavigation(false);
      closeFilterMenus();
    }
  });

  document.querySelectorAll<HTMLElement>("[data-accordion-group]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const trigger = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-acc-trigger]") : null;
      const item = trigger?.closest<HTMLElement>("[data-acc-item]");
      if (!trigger || !item) return;
      group.querySelectorAll<HTMLElement>("[data-acc-item]").forEach((candidate) => {
        const open = candidate === item && !candidate.classList.contains("is-open");
        candidate.classList.toggle("is-open", open);
        candidate.querySelector("[data-acc-trigger]")?.setAttribute("aria-expanded", String(open));
        const icon = candidate.querySelector<HTMLElement>(".benefits-section__acc-icon");
        if (icon) icon.textContent = open ? "−" : "+";
      });
    });
    group.addEventListener("keydown", (event) => {
      const triggers = [...group.querySelectorAll<HTMLButtonElement>("[data-acc-trigger]")];
      const current = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-acc-trigger]") : null;
      const index = current ? triggers.indexOf(current) : -1;
      if (index < 0) return;
      const next = event.key === "ArrowDown" ? (index + 1) % triggers.length : event.key === "ArrowUp" ? (index - 1 + triggers.length) % triggers.length : event.key === "Home" ? 0 : event.key === "End" ? triggers.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); triggers[next]?.focus(); }
    });
  });

  document.querySelectorAll<HTMLFormElement>("[data-inquiry-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      if (readOnly || !form.reportValidity()) return;
      event.preventDefault();
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const message = form.querySelector<HTMLElement>("[data-inquiry-status]") ?? form.parentElement?.querySelector<HTMLElement>("[data-inquiry-status]");
      const isRequest = form.querySelector<HTMLInputElement>('input[name="type"]')?.value === "product_request";
      setBusy(button, true, isRequest ? "Sending request" : "Sending");
      form.setAttribute("aria-busy", "true");
      if (message) message.textContent = "Sending…";
      try {
        const response = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not send your message.");
        form.reset();
        if (message) message.textContent = isRequest ? "Request received. The shop can now review it." : "Message received. The shop can now follow up.";
        announce(isRequest ? "Product request sent successfully" : "Message sent successfully");
      } catch (cause) {
        if (message) message.textContent = cause instanceof Error ? cause.message : "Could not send your message.";
        announce("Message could not be sent");
      } finally {
        setBusy(button, false);
        form.removeAttribute("aria-busy");
      }
    });
  });

  const money = (amount: number | null, currency: string | null) => {
    if (amount == null) return "—";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "ETB").toUpperCase() }).format(amount); }
    catch { return String(amount); }
  };
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") => {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const renderCart = (cart: any) => {
    if (!itemsRoot || !footer) return;
    itemsRoot.replaceChildren();
    const items = Array.isArray(cart?.items) ? cart.items : [];
    const count = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    syncCartCount(count);
    if (drawerCount) drawerCount.textContent = `${String(count).padStart(2, "0")} ITEM${count === 1 ? "" : "S"}`;
    if (!items.length) {
      const empty = element("div", "cart-drawer__empty");
      empty.append(element("h3", "type-heading-5", "Your cart is empty"), element("p", "type-body-s-400", "Explore the catalog and add something you need."));
      const shop = element("a", "btn btn--primary btn--large", "Continue Shopping"); shop.href = "/products"; empty.append(shop);
      itemsRoot.append(empty); footer.hidden = true; return;
    }
    for (const item of items) {
      const row = element("article", "cart-drawer__item"); row.dataset.lineItemId = item.id;
      const media = element("a", "cart-drawer__image img-wrapper") as HTMLAnchorElement; media.href = item.productHandle ? `/products/${encodeURIComponent(item.productHandle)}` : "/products";
      if (item.thumbnail) { const image = element("img") as HTMLImageElement; image.src = item.thumbnail; image.alt = ""; media.append(image); }
      const details = element("div", "cart-drawer__details"); const info = element("div", "cart-drawer__info");
      info.append(element("h3", "type-heading-5", item.title || "Product"));
      if (item.variantTitle) info.append(element("span", "cart-drawer__variant type-body-xs-400", item.variantTitle));
      info.append(element("p", "type-body-s-500", money(item.total ?? item.unitPrice, cart.currencyCode)));
      const actions = element("div", "cart-drawer__actions"); const quantity = element("div", "cart-drawer__quantity");
      const minus = element("button", "", "−") as HTMLButtonElement; minus.type = "button"; minus.dataset.cartQuantity = String(Math.max(1, Number(item.quantity) - 1)); minus.disabled = Number(item.quantity) <= 1; minus.setAttribute("aria-label", `Decrease ${item.title || "product"} quantity`);
      const amount = element("span", "", String(item.quantity));
      const plus = element("button", "", "+") as HTMLButtonElement; plus.type = "button"; plus.dataset.cartQuantity = String(Number(item.quantity) + 1); plus.setAttribute("aria-label", `Increase ${item.title || "product"} quantity`);
      quantity.append(minus, amount, plus);
      const remove = element("button", "cart-drawer__remove type-body-s-400", "REMOVE") as HTMLButtonElement; remove.type = "button"; remove.dataset.cartRemove = "";
      actions.append(quantity, remove); details.append(info, actions); row.append(media, details); itemsRoot.append(row);
    }
    footer.hidden = false;
    const total = footer.querySelector<HTMLElement>("[data-cart-total]"); if (total) total.textContent = money(cart.total, cart.currencyCode);
  };
  const loadCart = async () => {
    itemsRoot?.setAttribute("aria-busy", "true");
    if (itemsRoot) {
      const skeletons = Array.from({ length: 3 }, () => {
        const skeleton = element("div", "cart-drawer__skeleton");
        skeleton.setAttribute("aria-hidden", "true");
        skeleton.append(element("span"), element("span"), element("span"));
        return skeleton;
      });
      itemsRoot.replaceChildren(...skeletons);
    }
    if (status) status.textContent = "Loading your cart…";
    try { const response = await fetch("/cart-data", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.message || "Could not load your cart."); renderCart(result.cart); if (status) status.textContent = ""; }
    catch (cause) { if (status) status.textContent = cause instanceof Error ? cause.message : "Could not load your cart."; announce("Cart could not be loaded"); }
    finally { itemsRoot?.removeAttribute("aria-busy"); }
  };
  const openCart = async (cart?: any) => { if (!overlay) return; setNavigation(false); closeFilterMenus(); lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null; overlay.classList.add("is-visible"); overlay.setAttribute("aria-hidden", "false"); syncScrollLock(); window.requestAnimationFrame(() => window.requestAnimationFrame(() => { drawer?.classList.add("is-open"); drawer?.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus(); })); if (cart) renderCart(cart); else await loadCart(); };
  const closeCart = () => { drawer?.classList.remove("is-open"); overlay?.classList.remove("is-visible"); overlay?.setAttribute("aria-hidden", "true"); syncScrollLock(); lastFocused?.focus(); };
  document.querySelector("[data-cart-open]")?.addEventListener("click", () => { if (!readOnly) void openCart(); });
  drawer?.querySelector("[data-cart-close]")?.addEventListener("click", closeCart);
  overlay?.addEventListener("click", (event) => { if (event.target === overlay) closeCart(); });
  drawer?.addEventListener("click", async (event) => {
    if (readOnly) return; const target = event.target instanceof Element ? event.target : null; const row = target?.closest<HTMLElement>("[data-line-item-id]"); if (!row) return;
    const quantity = target?.closest<HTMLButtonElement>("[data-cart-quantity]"); const remove = target?.closest<HTMLButtonElement>("[data-cart-remove]"); if (!quantity && !remove) return;
    const action = quantity ?? remove; setBusy(action, true); row.setAttribute("aria-busy", "true");
    const body = new FormData(); body.set("lineItemId", row.dataset.lineItemId || ""); if (quantity) body.set("quantity", quantity.dataset.cartQuantity || "1");
    try { const response = await fetch(quantity ? "/actions/cart/update" : "/actions/cart/remove", { method: "POST", body, credentials: "same-origin", headers: { Accept: "application/json" } }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.message || "Could not update your cart."); renderCart(result.cart); window.dispatchEvent(new CustomEvent("ecs:cart-updated", { detail: result })); announce(remove ? "Item removed from cart" : "Cart quantity updated"); }
    catch (cause) { if (status) status.textContent = cause instanceof Error ? cause.message : "Could not update your cart."; announce("Cart could not be updated"); }
    finally { setBusy(action, false); row.removeAttribute("aria-busy"); }
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null; if (!form?.matches("[data-card-add-form], [data-add-form]") || readOnly) return;
    event.preventDefault(); const buttons = [...form.querySelectorAll<HTMLButtonElement>("button[type=submit]")]; const disabledState = new Map(buttons.map((button) => [button, button.disabled])); const cardLabelButton = form.matches("[data-card-add-form]") ? form.querySelector<HTMLButtonElement>(".product-card__add-btn") : null; if (cardLabelButton) setBusy(cardLabelButton, true, "Adding"); else setBusy(event.submitter instanceof HTMLButtonElement ? event.submitter : buttons[0], true, "Adding"); buttons.forEach((button) => { button.disabled = true; }); form.setAttribute("aria-busy", "true"); announce("Adding item to cart");
    try { const response = await fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin", headers: { Accept: "application/json" } }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.message || "Could not add this item."); announce("Item added to cart"); window.dispatchEvent(new CustomEvent("ecs:cart-updated", { detail: { ...result, openDrawer: true } })); }
    catch (cause) { const message = cause instanceof Error ? cause.message : "Could not add this item."; announce(message); showToast(message); const localStatus = form.closest("[data-product-detail]")?.querySelector<HTMLElement>(".nexa-product-notice"); if (localStatus) { localStatus.textContent = message; localStatus.hidden = false; } }
    finally { if (cardLabelButton) setBusy(cardLabelButton, false); else setBusy(event.submitter instanceof HTMLButtonElement ? event.submitter : buttons[0], false); buttons.forEach((button) => { button.disabled = disabledState.get(button) ?? false; }); form.removeAttribute("aria-busy"); }
  });
  window.addEventListener("ecs:cart-updated", ((event: CustomEvent) => { if (readOnly) return; const detail = event.detail; if (detail?.count != null) syncCartCount(detail.count); if (detail?.cart) { renderCart(detail.cart); if (detail.openDrawer) void openCart(detail.cart); } }) as EventListener);
  document.addEventListener("submit", (event) => {
    if (event.defaultPrevented || readOnly) return;
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    const button = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
    if (!form || !button) return;
    const idle = button.textContent?.trim().replace(/↗$/, "").trim() || "Working";
    const busyLabel = form.matches("[data-checkout-form]")
      ? (form.action.includes("/chapa") ? "Opening secure payment" : "Placing order")
      : `${idle.replace(/\.{3}|…$/u, "")}…`;
    form.setAttribute("aria-busy", "true");
    setBusy(button, true, busyLabel);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const filterWasOpen = Boolean(document.querySelector("[data-filter-menu].is-open"));
      const dropdownWasOpen = Boolean(dropdown?.classList.contains("is-open"));
      const navigationWasOpen = Boolean(header?.classList.contains("is-open"));
      closeFilterMenus(filterWasOpen);
      setNavigation(false);
      setDropdown(false);
      if (dropdownWasOpen) dropdownButton?.focus();
      if (navigationWasOpen) menu?.focus();
      if (overlay?.classList.contains("is-visible")) closeCart();
    }
    if (event.key === "Tab" && (overlay?.classList.contains("is-visible") || header?.classList.contains("is-open"))) {
      const focusable = focusableElements(overlay?.classList.contains("is-visible") ? drawer : header);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  if (!readOnly) { void loadAndSyncCartCount(); initWishlistController(); }
}
