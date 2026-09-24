import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { setCartCount as syncCartCount } from "../../../../lib/browser/cart-count";
import {
  $cart,
  $cartDrawerOpen,
  initCartStore,
  fetchCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
} from "../../../../lib/stores/cart";
import {
  $wishlist,
  initWishlistStore,
} from "../../../../lib/stores/wishlist";
import { initProductSearchSuggestions } from "../../../../lib/browser/product-search-suggestions";

export function initAfroStorefront() {
  const readOnly =
    document.body.dataset.editorMode === "true" || document.body.dataset.demoMode === "true";
  const messages =
    (window as Window & { __ECS_AFRO_MESSAGES__?: Record<string, string> }).__ECS_AFRO_MESSAGES__ ??
    {};
  const clientMessage = (key: string, fallback = "") => messages[key] || fallback;
  const locale = document.documentElement.lang === "am" ? "am-ET" : "en-ET";

  // --- Header Navigation ---
  const toggleBtn = document.getElementById("mobile-menu-toggle");
  const nav = document.querySelector(".site-header__nav");

  if (toggleBtn && nav) {
    toggleBtn.addEventListener("click", () => {
      const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
      toggleBtn.setAttribute("aria-expanded", String(!isExpanded));
      nav.classList.toggle("site-header__nav--open");
    });
  }

  // --- Search Modal ---
  initSearchModal();

  // --- Live Search Suggestions ---
  const searchForms = document.querySelectorAll<HTMLFormElement>("[data-product-search-suggestions]");
  searchForms.forEach((form) => initProductSearchSuggestions(form));

  // --- Header Nav Links & Scrollspy ---
  initHeaderNavigation();

  // --- Dropdowns ---
  initDropdowns();

  // --- Category Carousel ---
  initCategoryCarousel();

  // --- Hero Carousel ---
  initHeroCarousel();

  // --- Collections Carousel ---
  initCollectionsCarousel();

  // --- Home Filters ---
  initHomeFilters();

  // --- Shop Sidebar Filters & Accordions ---
  initShopFilters();

  // --- Product Detail Controls ---
  initProductDetail();

  // --- Cart Drawer ---
  initCartDrawerRuntime({ readOnly, clientMessage, locale });

  // --- Inquiries Form ---
  initInquiryForms({ readOnly, clientMessage });

  if (!readOnly) {
    initCartStore();
    void initWishlistStore();
  }
}

export function initSearchModal() {
  const modal = document.getElementById("search-modal");
  const openBtns = document.querySelectorAll("#search-toggle-btn, [data-search-open], .site-header__search-toggle");
  const closeBtn = document.getElementById("search-modal-close");
  const backdrop = document.getElementById("search-modal-backdrop");
  const input = document.getElementById("search-modal-input") as HTMLInputElement | null;

  if (!modal) return;

  function open() {
    modal?.classList.add("is-open", "search-modal--open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    window.setTimeout(() => {
      input?.focus();
    }, 50);
  }

  function close() {
    modal?.classList.remove("is-open", "search-modal--open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  openBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
  });

  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (modal.classList.contains("is-open") || modal.classList.contains("search-modal--open"))) {
      close();
    }
  });
}

export function initHeaderNavigation() {
  const navLinks = document.querySelectorAll<HTMLAnchorElement>(".site-header__link");
  const pathname = window.location.pathname;
  const isHome = pathname === "/" || pathname === "" || pathname === "/index.html";
  const isShop =
    pathname.startsWith("/products") ||
    pathname.startsWith("/shop") ||
    pathname.startsWith("/product");

  function setActiveNav(targetId: string | null) {
    navLinks.forEach((link) => {
      const navId = link.getAttribute("data-nav-id");
      if (navId === targetId) {
        link.classList.add("site-header__link--active", "type-body-500");
        link.classList.remove("type-body-400");
      } else {
        link.classList.remove("site-header__link--active", "type-body-500");
        link.classList.add("type-body-400");
      }
    });
  }

  function syncNavWithLocation() {
    const hash = window.location.hash.toLowerCase();
    if (isHome) {
      if (hash === "#categories") {
        setActiveNav("categories");
      } else if (hash === "#collections") {
        setActiveNav("collections");
      } else {
        setActiveNav("home");
      }
    } else if (isShop) {
      setActiveNav("shop");
    }
  }

  syncNavWithLocation();
  window.addEventListener("hashchange", syncNavWithLocation);

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      const navId = link.getAttribute("data-nav-id");
      if (!href) return;

      const hashIndex = href.indexOf("#");
      if (hashIndex !== -1) {
        const hash = href.substring(hashIndex);
        const targetId = hash.substring(1);
        const targetEl = document.getElementById(targetId);

        if (
          targetEl &&
          (window.location.pathname === "/" ||
            window.location.pathname === "" ||
            href.startsWith("#"))
        ) {
          e.preventDefault();
          if (navId) setActiveNav(navId);
          targetEl.scrollIntoView({ behavior: "smooth" });
          history.pushState(null, "", hash);
        }

        const nav = document.querySelector(".site-header__nav");
        const toggleBtn = document.getElementById("mobile-menu-toggle");
        if (nav && nav.classList.contains("site-header__nav--open")) {
          nav.classList.remove("site-header__nav--open");
          toggleBtn?.setAttribute("aria-expanded", "false");
        }
      }
    });
  });

  // Scrollspy for Homepage
  if (isHome) {
    const categoriesSection = document.getElementById("categories");
    const collectionsSection = document.getElementById("collections");

    const onScroll = () => {
      if (window.scrollY < 200) {
        setActiveNav("home");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (entry.target.id === "categories") {
                setActiveNav("categories");
              } else if (entry.target.id === "collections") {
                setActiveNav("collections");
              }
            }
          });
        },
        { threshold: 0.35, rootMargin: "-80px 0px -40% 0px" },
      );

      if (categoriesSection) observer.observe(categoriesSection);
      if (collectionsSection) observer.observe(collectionsSection);
    }
  }
}

export function initDropdowns(root: ParentNode = document) {
  const dropdowns = root.querySelectorAll<HTMLElement>("[data-dropdown]");

  dropdowns.forEach((dropdown) => {
    if (dropdown.dataset.dropdownReady === "true") return;
    dropdown.dataset.dropdownReady = "true";

    const trigger = dropdown.querySelector<HTMLButtonElement>(".dropdown__trigger");
    const menu = dropdown.querySelector<HTMLElement>(".dropdown__menu");
    const label = dropdown.querySelector<HTMLElement>("[data-dropdown-label]");
    const options = Array.from(dropdown.querySelectorAll<HTMLButtonElement>(".dropdown__option"));
    const hiddenInput = dropdown.querySelector<HTMLInputElement>("input[type='hidden']");
    if (!trigger || !menu || options.length === 0) return;

    const selected =
      options.find((option) => option.getAttribute("aria-selected") === "true") ?? options[0];
    dropdown.dataset.value = selected.dataset.value ?? "";
    if (label) label.textContent = selected.textContent?.trim() ?? "";
    if (hiddenInput) hiddenInput.value = selected.dataset.value ?? "";

    function close() {
      trigger!.setAttribute("aria-expanded", "false");
      menu!.hidden = true;
    }

    function open() {
      document.querySelectorAll<HTMLElement>("[data-dropdown]").forEach((other) => {
        if (other === dropdown) return;
        other.querySelector(".dropdown__trigger")?.setAttribute("aria-expanded", "false");
        const otherMenu = other.querySelector<HTMLElement>(".dropdown__menu");
        if (otherMenu) otherMenu.hidden = true;
      });
      trigger!.setAttribute("aria-expanded", "true");
      menu!.hidden = false;
    }

    function setValue(value: string, text: string, silent = false) {
      dropdown.dataset.value = value;
      if (label) label.textContent = text;
      if (hiddenInput) {
        hiddenInput.value = value;
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      options.forEach((option) => {
        option.setAttribute("aria-selected", String(option.dataset.value === value));
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

    options.forEach((option) => {
      option.addEventListener("click", () => {
        setValue(option.dataset.value ?? "", option.textContent?.trim() ?? "");
        close();
      });
    });

    dropdown.addEventListener("dropdown:set", ((event: Event) => {
      const value = (event as CustomEvent<{ value: string }>).detail?.value;
      const match = options.find((option) => option.dataset.value === value);
      if (!match) return;
      setValue(value, match.textContent?.trim() ?? "", true);
      close();
    }) as EventListener);

    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target as Node)) close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  });
}

export function initCategoryCarousel() {
  const viewport = document.getElementById("category-carousel-viewport");
  const track = document.getElementById("category-carousel-track");
  const prevBtn = document.getElementById("category-carousel-prev");
  const nextBtn = document.getElementById("category-carousel-next");

  if (!viewport || !track) return undefined;

  const slides = Array.from(track.querySelectorAll<HTMLElement>(".category-card"));
  if (slides.length === 0) return undefined;

  let activeIndex = 0;

  function updateActiveSlide(targetIndex: number) {
    activeIndex = Math.max(0, Math.min(targetIndex, slides.length - 1));

    slides.forEach((slide, idx) => {
      const isActive = idx === activeIndex;
      if (isActive) {
        slide.classList.add("category-card--active");
        slide.classList.remove("category-card--standard");
        slide.setAttribute("aria-selected", "true");
      } else {
        slide.classList.remove("category-card--active");
        slide.classList.add("category-card--standard");
        slide.setAttribute("aria-selected", "false");
      }
    });

    if (prevBtn) {
      const isFirst = activeIndex === 0;
      prevBtn.toggleAttribute("disabled", isFirst);
      prevBtn.style.opacity = isFirst ? "0.35" : "1";
      prevBtn.style.cursor = isFirst ? "not-allowed" : "pointer";
    }
    if (nextBtn) {
      const isLast = activeIndex === slides.length - 1;
      nextBtn.toggleAttribute("disabled", isLast);
      nextBtn.style.opacity = isLast ? "0.35" : "1";
      nextBtn.style.cursor = isLast ? "not-allowed" : "pointer";
    }

    setTimeout(() => {
      if (!viewport || !track) return;
      const activeSlide = slides[activeIndex];
      if (!activeSlide) return;

      const viewportWidth = viewport.clientWidth;
      const trackWidth = track.scrollWidth;
      const maxScroll = Math.max(0, trackWidth - viewportWidth);
      const slideLeft = activeSlide.offsetLeft;
      const slideWidth = activeSlide.offsetWidth;
      const slideRight = slideLeft + slideWidth;

      let targetScroll = viewport.scrollLeft;
      if (slideRight > viewport.scrollLeft + viewportWidth) {
        targetScroll = Math.min(maxScroll, slideRight - viewportWidth + 30);
      } else if (slideLeft < viewport.scrollLeft) {
        targetScroll = Math.max(0, slideLeft - 30);
      }

      if (activeIndex === slides.length - 1) targetScroll = maxScroll;
      else if (activeIndex === 0) targetScroll = 0;

      viewport.scrollTo({ left: targetScroll, behavior: "smooth" });
    }, 50);
  }

  prevBtn?.addEventListener("click", () => {
    if (activeIndex > 0) updateActiveSlide(activeIndex - 1);
  });

  nextBtn?.addEventListener("click", () => {
    if (activeIndex < slides.length - 1) updateActiveSlide(activeIndex + 1);
  });

  slides.forEach((slide, idx) => {
    slide.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (idx === activeIndex) {
        if (target.closest("a") || target.closest("button")) return;
        const href = slide.dataset.href;
        if (href) window.location.href = href;
        return;
      }
      e.preventDefault();
      updateActiveSlide(idx);
    });
  });

  updateActiveSlide(0);
}

export function initCollectionsCarousel(): EmblaCarouselType | undefined {
  const viewportNode = document.getElementById("collections-carousel-viewport");
  const prevBtn = document.getElementById("col-prev-btn");
  const nextBtn = document.getElementById("col-next-btn");
  if (!viewportNode) return undefined;

  const emblaApi = EmblaCarousel(viewportNode, { align: "start", loop: true, skipSnaps: false });
  prevBtn?.addEventListener("click", () => emblaApi.scrollPrev());
  nextBtn?.addEventListener("click", () => emblaApi.scrollNext());
  return emblaApi;
}

export function initHeroCarousel(): EmblaCarouselType | undefined {
  const viewportNode = document.getElementById("hero-carousel-viewport");
  const prevBtn = document.getElementById("hero-carousel-prev") as HTMLButtonElement | null;
  const nextBtn = document.getElementById("hero-carousel-next") as HTMLButtonElement | null;
  if (!viewportNode) return undefined;

  const emblaApi = EmblaCarousel(viewportNode, {
    align: "start",
    loop: false,
    skipSnaps: false,
    dragFree: false,
  });

  const syncButtons = () => {
    if (!emblaApi) return;
    if (prevBtn) {
      prevBtn.disabled = !emblaApi.canScrollPrev();
    }
    if (nextBtn) {
      nextBtn.disabled = !emblaApi.canScrollNext();
    }
  };

  prevBtn?.addEventListener("click", () => emblaApi.scrollPrev());
  nextBtn?.addEventListener("click", () => emblaApi.scrollNext());

  emblaApi.on("select", syncButtons);
  emblaApi.on("init", syncButtons);
  syncButtons();

  return emblaApi;
}

export function initHomeFilters() {
  const grid = document.getElementById("home-product-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll<HTMLElement>(".product-card"));
  const countEl = document.getElementById("home-item-count");
  const categoryMenu = document.getElementById("home-filter-category");
  const collectionMenu = document.getElementById("home-filter-collection");
  const sortMenu = document.getElementById("home-filter-sort");
  const minInput = document.getElementById("home-price-min") as HTMLInputElement | null;
  const maxInput = document.getElementById("home-price-max") as HTMLInputElement | null;
  const clearBtn = document.getElementById("home-clear-filters");

  const state = {
    category: "all",
    collection: "all",
    sort: "featured",
    min: 0,
    max: 25000,
  };

  function parsePrice(card: HTMLElement) {
    const priceText = card.querySelector(".product-card__price")?.textContent || "0";
    return parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;
  }

  function isDefault() {
    return (
      state.category === "all" &&
      state.collection === "all" &&
      state.sort === "featured" &&
      state.min <= 0 &&
      state.max >= 25000
    );
  }

  function apply() {
    let matches = cards.filter((card) => {
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

    if (state.sort === "featured") {
      matches = cards.filter((card) => matches.includes(card));
    } else if (state.sort === "price-low") matches.sort((a, b) => parsePrice(a) - parsePrice(b));
    else if (state.sort === "price-high") matches.sort((a, b) => parsePrice(b) - parsePrice(a));
    else if (state.sort === "title") {
      matches.sort((a, b) =>
        (a.querySelector(".product-card__title")?.textContent || "").localeCompare(
          b.querySelector(".product-card__title")?.textContent || "",
        ),
      );
    }

    const visible = isDefault() ? matches.slice(0, 15) : matches;
    cards.forEach((card) => {
      card.classList.add("is-deferred");
    });
    if (grid) {
      visible.forEach((card) => {
        card.classList.remove("is-deferred");
        grid.appendChild(card);
      });
    }

    if (countEl) {
      countEl.textContent = `Showing ${visible.length} of ${cards.length} products`;
    }
  }

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

  function readPrice(input: HTMLInputElement | null, fallback: number) {
    if (!input || input.value.trim() === "") return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? Math.max(0, Math.min(25000, value)) : fallback;
  }

  function onPriceChange() {
    state.min = readPrice(minInput, 0);
    state.max = readPrice(maxInput, 25000);
    if (state.min > state.max) state.max = state.min;
    apply();
  }

  minInput?.addEventListener("change", onPriceChange);
  maxInput?.addEventListener("change", onPriceChange);

  clearBtn?.addEventListener("click", () => {
    state.category = "all";
    state.collection = "all";
    state.sort = "featured";
    state.min = 0;
    state.max = 25000;
    if (minInput) minInput.value = "";
    if (maxInput) maxInput.value = "";
    categoryMenu?.dispatchEvent(new CustomEvent("dropdown:set", { detail: { value: "all" } }));
    collectionMenu?.dispatchEvent(new CustomEvent("dropdown:set", { detail: { value: "all" } }));
    sortMenu?.dispatchEvent(new CustomEvent("dropdown:set", { detail: { value: "featured" } }));
    apply();
  });
}

export function initShopFilters() {
  const sidebar = document.getElementById("shop-sidebar");
  const mobileToggle = document.getElementById("shop-mobile-filter-toggle");
  const closeBtn = document.getElementById("shop-sidebar-close");

  // Mobile sidebar drawer
  mobileToggle?.addEventListener("click", () => {
    sidebar?.classList.add("is-open");
    document.body.classList.add("no-scroll");
  });

  closeBtn?.addEventListener("click", () => {
    sidebar?.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  });

  // Collapsible Accordion Groups
  const groupToggles = document.querySelectorAll<HTMLButtonElement>(".shop-sidebar__group-toggle");
  groupToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const group = toggle.closest<HTMLElement>(".shop-sidebar__group");
      if (!group) return;
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));
      group.classList.toggle("is-collapsed", isExpanded);
    });
  });

  // Price Slider & Inputs on Shop page
  const minInput = document.getElementById("shop-price-min") as HTMLInputElement | null;
  const maxInput = document.getElementById("shop-price-max") as HTMLInputElement | null;
  const minSlider = document.getElementById("shop-price-min-slider") as HTMLInputElement | null;
  const maxSlider = document.getElementById("shop-price-slider") as HTMLInputElement | null;
  const fill = document.getElementById("shop-price-fill");

  function updateFill() {
    if (!minSlider || !maxSlider || !fill) return;
    const minVal = Number(minSlider.value);
    const maxVal = Number(maxSlider.value);
    const minPercent = (minVal / 25000) * 100;
    const maxPercent = (maxVal / 25000) * 100;
    fill.style.left = `${minPercent}%`;
    fill.style.right = `${100 - maxPercent}%`;
  }

  function commitPriceFilter() {
    const min = minInput ? Number(minInput.value) : 0;
    const max = maxInput ? Number(maxInput.value) : 25000;
    const url = new URL(window.location.href);
    if (min > 0) url.searchParams.set("price_min", String(min));
    else url.searchParams.delete("price_min");
    if (max < 25000) url.searchParams.set("price_max", String(max));
    else url.searchParams.delete("price_max");
    url.searchParams.delete("offset");
    url.hash = "shop-products";
    window.location.href = url.toString();
  }

  minSlider?.addEventListener("input", () => {
    if (!minSlider || !maxSlider || !minInput) return;
    if (Number(minSlider.value) > Number(maxSlider.value)) {
      minSlider.value = maxSlider.value;
    }
    minInput.value = minSlider.value;
    updateFill();
  });

  maxSlider?.addEventListener("input", () => {
    if (!minSlider || !maxSlider || !maxInput) return;
    if (Number(maxSlider.value) < Number(minSlider.value)) {
      maxSlider.value = minSlider.value;
    }
    maxInput.value = maxSlider.value;
    updateFill();
  });

  minSlider?.addEventListener("change", commitPriceFilter);
  maxSlider?.addEventListener("change", commitPriceFilter);

  minInput?.addEventListener("change", () => {
    if (!minSlider || !minInput) return;
    minSlider.value = minInput.value;
    updateFill();
    commitPriceFilter();
  });

  maxInput?.addEventListener("change", () => {
    if (!maxSlider || !maxInput) return;
    maxSlider.value = maxInput.value;
    updateFill();
    commitPriceFilter();
  });
}

function replay(el: Element, className: string) {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

export function initProductDetail() {
  const mainImage = document.querySelector<HTMLImageElement>(".product-gallery__main img");
  const thumbBtns = document.querySelectorAll<HTMLButtonElement>(".product-gallery__thumb-btn");

  thumbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const thumbImg = btn.querySelector("img");
      if (mainImage && thumbImg) {
        mainImage.src = thumbImg.src;
        mainImage.srcset = thumbImg.srcset || "";
      }
      thumbBtns.forEach((b) => {
        b.classList.remove("product-gallery__thumb-btn--active");
      });
      btn.classList.add("product-gallery__thumb-btn--active");
    });
  });

  const swatches = document.querySelectorAll<HTMLButtonElement>(".product-details__swatch");
  swatches.forEach((swatch) => {
    swatch.addEventListener("click", () => {
      swatches.forEach((s) => {
        s.classList.remove("product-details__swatch--active");
      });
      swatch.classList.add("product-details__swatch--active");
    });
  });

  const sizeBtns = document.querySelectorAll<HTMLButtonElement>(".product-details__size-btn");
  sizeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      sizeBtns.forEach((b) => {
        b.classList.remove("product-details__size-btn--active");
      });
      btn.classList.add("product-details__size-btn--active");
    });
  });

  const qtyMinus = document.querySelector<HTMLButtonElement>(".product-details__qty-btn--minus");
  const qtyPlus = document.querySelector<HTMLButtonElement>(".product-details__qty-btn--plus");
  const qtyValue = document.querySelector<HTMLSpanElement>(".product-details__qty-value");
  const qtyInput = document.getElementById("pdp-quantity-input") as HTMLInputElement | null;

  if (qtyMinus && qtyPlus && qtyValue) {
    qtyMinus.addEventListener("click", () => {
      const count = parseInt(qtyValue.textContent || "1", 10);
      if (count > 1) {
        qtyValue.textContent = (count - 1).toString();
        if (qtyInput) qtyInput.value = (count - 1).toString();
        replay(qtyValue, "is-tick");
      }
    });

    qtyPlus.addEventListener("click", () => {
      const count = parseInt(qtyValue.textContent || "1", 10);
      qtyValue.textContent = (count + 1).toString();
      if (qtyInput) qtyInput.value = (count + 1).toString();
      replay(qtyValue, "is-tick");
    });
  }
}

function initInquiryForms({
  readOnly,
  clientMessage,
}: {
  readOnly: boolean;
  clientMessage: (k: string, f?: string) => string;
}) {
  document.querySelectorAll<HTMLFormElement>("[data-inquiry-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      if (readOnly || !form.reportValidity()) return;
      event.preventDefault();
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const message =
        form.querySelector<HTMLElement>("[data-inquiry-status]") ??
        form.parentElement?.querySelector<HTMLElement>("[data-inquiry-status]");
      const isRequest =
        form.querySelector<HTMLInputElement>('input[name="type"]')?.value === "product_request";

      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
      }
      form.setAttribute("aria-busy", "true");
      if (message)
        message.textContent = isRequest
          ? clientMessage("requestSending", "Sending...")
          : clientMessage("contactSending", "Sending...");

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            isRequest
              ? clientMessage("requestFailed", "Request failed")
              : clientMessage("contactFailed", "Sending failed"),
          );
        form.reset();
        if (message)
          message.textContent = isRequest
            ? clientMessage("requestReceived", "Request received! We'll be in touch.")
            : clientMessage("contactReceived", "Message sent! Thank you.");
      } catch (cause) {
        if (message)
          message.textContent = cause instanceof Error ? cause.message : "Error submitting inquiry";
      } finally {
        if (button) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        }
        form.removeAttribute("aria-busy");
      }
    });
  });
}

function initCartDrawerRuntime({
  readOnly,
  clientMessage,
  locale,
}: {
  readOnly: boolean;
  clientMessage: (k: string, f?: string) => string;
  locale: string;
}) {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-backdrop");
  const closeBtn = document.getElementById("cart-close-btn");
  const continueBtn = document.getElementById("cart-continue-btn");
  const cartToggleBtn = document.getElementById("cart-toggle-btn");
  const itemsRoot = drawer?.querySelector<HTMLElement>("[data-cart-items]");
  const summary = drawer?.querySelector<HTMLElement>("[data-cart-footer]");
  const empty = document.getElementById("cart-empty");

  function openDrawer(cart?: any) {
    if (drawer) {
      drawer.classList.add("cart-drawer--open");
      document.body.classList.add("no-scroll");
      if (cart) renderCart(cart);
      else {
        const current = $cart.get();
        if (current) renderCart(current);
        else void fetchCart();
      }
    }
  }

  function closeDrawer() {
    if (drawer) {
      drawer.classList.remove("cart-drawer--open");
      document.body.classList.remove("no-scroll");
      $cartDrawerOpen.set(false);
    }
  }

  if (cartToggleBtn) {
    cartToggleBtn.addEventListener("click", () => {
      if (!readOnly) openDrawer();
    });
  }

  if (backdrop) backdrop.addEventListener("click", closeDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (continueBtn) continueBtn.addEventListener("click", closeDrawer);

  const money = (amount: number | null, currency: string | null) => {
    if (amount == null) return "—";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: (currency || "ETB").toUpperCase(),
      }).format(amount);
    } catch {
      return `Br. ${amount.toFixed(2)}`;
    }
  };

  const renderCart = (cart: any) => {
    if (!itemsRoot || !summary) return;
    const priorIds = new Set(
      Array.from(itemsRoot.querySelectorAll<HTMLElement>(".cart-item")).map(
        (el) => el.dataset.itemId,
      ),
    );
    itemsRoot.replaceChildren();
    const items = Array.isArray(cart?.items) ? cart.items : [];
    const count = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    syncCartCount(count);

    if (empty) empty.hidden = items.length > 0;
    summary.hidden = items.length === 0;
    itemsRoot.hidden = items.length === 0;

    for (const item of items) {
      const line = document.createElement("div");
      line.setAttribute("role", "listitem");
      line.className = "cart-item";
      if (!priorIds.has(item.id)) {
        line.classList.add("is-entering");
      }
      line.dataset.itemId = item.id;
      line.dataset.lineItemId = item.id;

      line.innerHTML = `
        <div class="cart-item__thumb">
          <div class="img-wrapper">
            ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.title || ""}" class="cover" width="84" height="84" />` : ""}
          </div>
        </div>
        <div class="cart-item__details">
          <div class="cart-item__top">
            <div class="cart-item__titles">
              <h4 class="cart-item__title type-body-500">${item.title || "Piece"}</h4>
              ${item.variantTitle ? `<p class="cart-item__brand type-body-s-400">${item.variantTitle}</p>` : ""}
            </div>
            <button type="button" class="cart-item__remove-btn" aria-label="Remove item" data-cart-remove data-line-item-id="${item.id}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" data-icon="trash"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <div class="cart-item__bottom">
            <div class="cart-item__quantity" aria-label="Quantity selector">
              <button type="button" class="cart-item__qty-btn cart-item__qty-btn--minus" aria-label="Decrease quantity" data-cart-quantity="${Math.max(1, Number(item.quantity) - 1)}" data-line-item-id="${item.id}" ${Number(item.quantity) <= 1 ? "disabled" : ""}>
                <svg width="10" height="2" viewBox="0 0 10 2" fill="none" data-icon="minus"><path d="M1 1h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
              <span class="cart-item__qty-val type-body-400">${item.quantity}</span>
              <button type="button" class="cart-item__qty-btn cart-item__qty-btn--plus" aria-label="Increase quantity" data-cart-quantity="${Number(item.quantity) + 1}" data-line-item-id="${item.id}">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" data-icon="plus"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
            </div>
            <span class="cart-item__price type-body-500">${money(item.total ?? item.unitPrice, cart.currencyCode)}</span>
          </div>
        </div>
      `;
      itemsRoot.appendChild(line);
    }

    const subtotalEl = summary.querySelector<HTMLElement>("[data-cart-subtotal]");
    const totalEl = summary.querySelector<HTMLElement>("[data-cart-total]");
    if (subtotalEl) subtotalEl.textContent = money(cart.subtotal ?? cart.total, cart.currencyCode);
    if (totalEl) totalEl.textContent = money(cart.total, cart.currencyCode);
  };

  // Cart item actions (increase / decrease / remove) with Nanostores optimistic update
  drawer?.addEventListener("click", async (event) => {
    if (readOnly) return;
    const target = event.target instanceof Element ? event.target : null;
    const quantityBtn = target?.closest<HTMLButtonElement>("[data-cart-quantity]");
    const removeBtn = target?.closest<HTMLButtonElement>("[data-cart-remove]");
    if (!quantityBtn && !removeBtn) return;

    const lineItemId = quantityBtn?.dataset.lineItemId || removeBtn?.dataset.lineItemId;
    if (!lineItemId) return;

    if (quantityBtn) {
      const valEl = quantityBtn
        .closest(".cart-item__quantity")
        ?.querySelector(".cart-item__qty-val");
      if (valEl) replay(valEl, "is-tick");
      const qty = Number(quantityBtn.dataset.cartQuantity || "1");
      await updateCartItemQuantity(lineItemId, qty);
    } else if (removeBtn) {
      await removeCartItem(lineItemId);
    }
  });

  // Subscribe to $cart nanostore
  $cart.subscribe((cart) => {
    if (!readOnly && cart) {
      renderCart(cart);
    }
  });

  // Subscribe to $cartDrawerOpen nanostore
  $cartDrawerOpen.subscribe((isOpen) => {
    if (isOpen && !drawer?.classList.contains("cart-drawer--open")) {
      openDrawer();
    } else if (!isOpen && drawer?.classList.contains("cart-drawer--open")) {
      closeDrawer();
    }
  });

  // Handle Add-to-cart form submissions with Nanostores optimistic update
  document.addEventListener("submit", async (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form?.matches("[data-card-add-form], [data-add-form]") || readOnly) return;
    event.preventDefault();

    const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (submitBtn) {
      submitBtn.disabled = true;
      replay(submitBtn, "is-added");
    }

    const cartToggle = document.getElementById("cart-toggle-btn");
    if (cartToggle) replay(cartToggle, "is-bump");

    await addToCart({ form, openDrawer: true });

    if (submitBtn) {
      submitBtn.disabled = false;
      window.setTimeout(() => submitBtn.classList.remove("is-added"), 1200);
    }
  });
}
