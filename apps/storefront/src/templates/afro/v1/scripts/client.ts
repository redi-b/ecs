import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { setCartCount as syncCartCount } from "../../../../lib/browser/cart-count";
import {
  $cart,
  $cartDrawerOpen,
  fetchCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
} from "../../../../lib/stores/cart";
import { initStorefrontRuntime } from "../../../../lib/browser/storefront-runtime";
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
  const searchForms = document.querySelectorAll<HTMLFormElement>(
    "[data-product-search-suggestions]",
  );
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

  // --- Promo Countdown ---
  initCountdown();

  // --- Cart Drawer ---
  initCartDrawerRuntime({ readOnly, locale, clientMessage });

  // --- Inquiries Form ---
  initInquiryForms({ readOnly, clientMessage });

  if (!readOnly) {
    initStorefrontRuntime();
  }
}

// The promo bar rendered a frozen "12:00:42" — the field is merchant-editable but
// nothing ever ticked it. Tick down from the configured duration instead.
// ponytail: counts down from page load, so a refresh restarts it. If the promo ever
// needs a fixed deadline, add a target datetime to the schema and diff against that.
export function initCountdown() {
  const node = document.getElementById("header-countdown");
  if (!node) return;
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec((node.textContent || "").trim());
  // Anything that is not a plain duration ("Ends Sunday", "Limited stock") is
  // merchant copy, so it is left exactly as authored.
  if (!match) return;
  let remaining = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  if (!Number.isFinite(remaining) || remaining <= 0) return;

  const pad = (value: number) => String(value).padStart(2, "0");
  const render = () => {
    node.textContent =
      `${pad(Math.floor(remaining / 3600))}:` +
      `${pad(Math.floor((remaining % 3600) / 60))}:` +
      `${pad(remaining % 60)}`;
  };
  render();

  let timer = 0;
  timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      window.clearInterval(timer);
      return;
    }
    render();
  }, 1000);
}

export function initSearchModal() {
  const modal = document.getElementById("search-modal");
  const openBtns = document.querySelectorAll(
    "#search-toggle-btn, [data-search-open], .site-header__search-toggle",
  );
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
    if (
      e.key === "Escape" &&
      (modal.classList.contains("is-open") || modal.classList.contains("search-modal--open"))
    ) {
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
  locale,
  clientMessage,
}: {
  readOnly: boolean;
  locale: string;
  clientMessage: (key: string, fallback?: string) => string;
}) {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-backdrop");
  const closeBtn = document.getElementById("cart-close-btn");
  const continueBtn = document.getElementById("cart-continue-btn");
  const cartToggleBtn = document.getElementById("cart-toggle-btn");
  const itemsRoot = drawer?.querySelector<HTMLElement>("[data-cart-items]");
  const summary = drawer?.querySelector<HTMLElement>("[data-cart-footer]");
  const empty = document.getElementById("cart-empty");
  const status = drawer?.querySelector<HTMLElement>("[data-cart-status]");

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

  // Cart contents are merchant-controlled, so the drawer never builds markup from
  // them. Nodes are created and filled through properties/textContent, which makes
  // a title like `<img src=x onerror=...>` inert text instead of live HTML.
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text = "",
  ): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  // Icon geometry is developer-authored and static. Nothing from the cart reaches it.
  const icon = (
    name: string,
    viewBox: string,
    size: [number, number],
    d: string,
    strokeWidth: string,
  ) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(size[0]));
    svg.setAttribute("height", String(size[1]));
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("fill", "none");
    svg.setAttribute("data-icon", name);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", strokeWidth);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  };

  // Cart URLs come from the API, so refuse anything that is not http(s) or
  // root-relative. Blocks `javascript:` and protocol-relative sources.
  const safeUrl = (value: unknown): string => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    try {
      const url = new URL(raw, window.location.origin);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  };

  // [data-cart-status] is a live region that ships in CartDrawer.astro but was
  // never written to, so cart changes were silent for screen readers.
  let announceSeq = 0;
  const announce = (message: string) => {
    if (!status || !message) return;
    const seq = ++announceSeq;
    status.textContent = "";
    window.setTimeout(() => {
      if (seq !== announceSeq) return;
      status.textContent = message;
      window.setTimeout(() => {
        if (seq === announceSeq) status.textContent = "";
      }, 5000);
    }, 30);
  };

  const renderCart = (cart: any) => {
    if (!itemsRoot || !summary) return;
    const priorIds = new Set(
      Array.from(itemsRoot.querySelectorAll<HTMLElement>(".cart-item")).map(
        (node) => node.dataset.itemId,
      ),
    );
    // Rebuilding the list wholesale destroys the button the user just pressed and
    // drops focus to <body>. Remember where focus was so it can be restored below.
    const active = document.activeElement as HTMLElement | null;
    const focusKey =
      active && itemsRoot.contains(active)
        ? {
            lineId: active.closest<HTMLElement>("[data-line-item-id]")?.dataset.lineItemId,
            action: active.dataset.cartAction,
          }
        : null;
    itemsRoot.replaceChildren();
    const items = Array.isArray(cart?.items) ? cart.items : [];
    const count = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    syncCartCount(count);

    if (empty) empty.hidden = items.length > 0;
    summary.hidden = items.length === 0;
    itemsRoot.hidden = items.length === 0;

    for (const item of items) {
      const line = el("div", "cart-item");
      line.setAttribute("role", "listitem");
      if (!priorIds.has(item.id)) {
        line.classList.add("is-entering");
      }
      line.dataset.itemId = item.id;
      line.dataset.lineItemId = item.id;
      const title = item.title || clientMessage("product", "Piece");

      const thumb = el("div", "cart-item__thumb");
      const thumbWrap = el("div", "img-wrapper");
      const src = safeUrl(item.thumbnail);
      if (src) {
        const image = el("img", "cover") as HTMLImageElement;
        image.src = src;
        // Decorative: the product name is rendered as text right beside it.
        image.alt = "";
        image.width = 84;
        image.height = 84;
        thumbWrap.appendChild(image);
      }
      thumb.appendChild(thumbWrap);

      const details = el("div", "cart-item__details");
      const top = el("div", "cart-item__top");
      const titles = el("div", "cart-item__titles");
      titles.appendChild(el("h4", "cart-item__title type-body-500", title));
      if (item.variantTitle) {
        titles.appendChild(el("p", "cart-item__brand type-body-s-400", String(item.variantTitle)));
      }

      const removeBtn = el("button", "cart-item__remove-btn") as HTMLButtonElement;
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", `${clientMessage("remove", "Remove item")}: ${title}`);
      removeBtn.dataset.cartAction = "remove";
      removeBtn.dataset.cartRemove = "";
      removeBtn.dataset.lineItemId = item.id;
      removeBtn.appendChild(
        icon(
          "trash",
          "0 0 16 16",
          [16, 16],
          "M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z",
          "1.2",
        ),
      );
      top.append(titles, removeBtn);

      const bottom = el("div", "cart-item__bottom");
      const quantity = el("div", "cart-item__quantity");
      quantity.setAttribute("aria-label", `${clientMessage("quantity", "Quantity")}: ${title}`);
      const qty = Math.max(1, Number(item.quantity) || 1);

      const minus = el(
        "button",
        "cart-item__qty-btn cart-item__qty-btn--minus",
      ) as HTMLButtonElement;
      minus.type = "button";
      minus.setAttribute(
        "aria-label",
        `${clientMessage("decreaseQuantity", "Decrease quantity")}: ${title}`,
      );
      minus.dataset.cartAction = "dec";
      minus.dataset.cartQuantity = String(Math.max(1, qty - 1));
      minus.dataset.lineItemId = item.id;
      minus.disabled = qty <= 1;
      minus.appendChild(icon("minus", "0 0 10 2", [10, 2], "M1 1h8", "1.5"));

      const qtyValue = el("span", "cart-item__qty-val type-body-400", String(item.quantity));
      qtyValue.setAttribute("aria-live", "polite");

      const plus = el("button", "cart-item__qty-btn cart-item__qty-btn--plus") as HTMLButtonElement;
      plus.type = "button";
      plus.setAttribute(
        "aria-label",
        `${clientMessage("increaseQuantity", "Increase quantity")}: ${title}`,
      );
      plus.dataset.cartAction = "inc";
      plus.dataset.cartQuantity = String(qty + 1);
      plus.dataset.lineItemId = item.id;
      plus.appendChild(icon("plus", "0 0 10 10", [10, 10], "M5 1v8M1 5h8", "1.5"));

      quantity.append(minus, qtyValue, plus);
      bottom.append(
        quantity,
        el(
          "span",
          "cart-item__price type-body-500",
          money(item.total ?? item.unitPrice, cart.currencyCode),
        ),
      );

      details.append(top, bottom);
      line.append(thumb, details);
      itemsRoot.appendChild(line);
    }

    const subtotalEl = summary.querySelector<HTMLElement>("[data-cart-subtotal]");
    const totalEl = summary.querySelector<HTMLElement>("[data-cart-total]");
    if (subtotalEl) subtotalEl.textContent = money(cart.subtotal ?? cart.total, cart.currencyCode);
    if (totalEl) totalEl.textContent = money(cart.total, cart.currencyCode);

    if (focusKey?.lineId && focusKey.action) {
      const restored = itemsRoot.querySelector<HTMLButtonElement>(
        `[data-line-item-id="${CSS.escape(focusKey.lineId)}"] [data-cart-action="${focusKey.action}"]`,
      );
      if (restored && !restored.disabled) restored.focus();
    }
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
      try {
        await updateCartItemQuantity(lineItemId, qty);
        announce(clientMessage("cartQuantityUpdated", "Quantity updated."));
      } catch (error) {
        console.error("[afro] cart quantity update failed", error);
        announce(clientMessage("cartUpdateFailed", "Could not update quantity. Please try again."));
        // The optimistic update is not rolled back on failure, so resync from the server.
        void fetchCart();
      }
    } else if (removeBtn) {
      try {
        await removeCartItem(lineItemId);
        announce(clientMessage("cartItemRemoved", "Item removed from your cart."));
      } catch (error) {
        console.error("[afro] cart item removal failed", error);
        announce(
          clientMessage("cartUpdateFailed", "Could not remove that item. Please try again."),
        );
        void fetchCart();
      }
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
    if (submitBtn) submitBtn.disabled = true;

    try {
      await addToCart({ form, openDrawer: true });
      // Only celebrate once the cart has actually accepted the item.
      if (submitBtn) {
        replay(submitBtn, "is-added");
        window.setTimeout(() => submitBtn.classList.remove("is-added"), 1200);
      }
      const cartToggle = document.getElementById("cart-toggle-btn");
      if (cartToggle) replay(cartToggle, "is-bump");
      announce(clientMessage("cartItemAdded", "Added to your cart."));
    } catch (error) {
      console.error("[afro] add to cart failed", error);
      announce(
        clientMessage(
          "cartAddFailed",
          "Could not add to cart. Please check your connection and try again.",
        ),
      );
    } finally {
      // Without this, a rejected request left the button permanently disabled.
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
