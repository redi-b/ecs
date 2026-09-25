const CAROUSEL_UPDATED_EVENT = "ecs:hero-carousel-updated";

function mountHeroCarousel(root: HTMLElement) {
  const viewport = root.querySelector<HTMLElement>("[data-promo-viewport]");
  const dots = root.querySelector<HTMLElement>("[data-promo-dots]");
  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-promo-slide]"));
  if (!viewport || !dots || slides.length === 0) return;

  let selectedIndex = 0;
  let autoplayTimer: number | undefined;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const canScrollNext = () => selectedIndex < slides.length - 1;

  const scrollTo = (index: number) => {
    selectedIndex = (index + slides.length) % slides.length;
    render();
  };

  const scrollNext = () => {
    scrollTo((selectedIndex + 1) % slides.length);
  };

  const stopAutoplay = () => {
    if (autoplayTimer !== undefined) window.clearInterval(autoplayTimer);
    autoplayTimer = undefined;
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (slides.length < 2 || reducedMotion.matches || document.hidden) {
      return;
    }
    autoplayTimer = window.setInterval(() => {
      if (canScrollNext()) scrollNext();
      else scrollTo(0);
    }, 6000);
  };

  const render = () => {
    dots.replaceChildren(
      ...slides.map((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.dataset.promoDot = String(index);
        dot.setAttribute("aria-label", `Show featured product ${index + 1}`);
        if (index === selectedIndex) dot.setAttribute("aria-current", "true");
        return dot;
      }),
    );
    dots.hidden = slides.length < 2;
    slides.forEach((slide, index) => {
      const active = index === selectedIndex;
      slide.setAttribute("aria-hidden", String(!active));
      slide.classList.toggle("is-active", active);
    });
  };

  dots.addEventListener("click", (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-promo-dot]")
        : null;
    if (!target) return;
    const index = Number.parseInt(target.dataset.promoDot ?? "", 10);
    if (Number.isInteger(index)) {
      scrollTo(index);
      startAutoplay();
    }
  });

  root.addEventListener("pointerenter", stopAutoplay);
  root.addEventListener("pointerleave", startAutoplay);
  root.addEventListener("focusin", stopAutoplay);
  root.addEventListener("focusout", (event) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !root.contains(nextTarget)) startAutoplay();
  });
  document.addEventListener("visibilitychange", () =>
    document.hidden ? stopAutoplay() : startAutoplay(),
  );
  reducedMotion.addEventListener("change", startAutoplay);

  root.addEventListener(CAROUSEL_UPDATED_EVENT, () => {
    scrollTo(0);
    render();
    startAutoplay();
  });
  render();
  startAutoplay();
}

export function initHeroCarousels() {
  document.querySelectorAll<HTMLElement>("[data-promo-carousel]").forEach(mountHeroCarousel);
}
