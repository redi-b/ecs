import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";

const CAROUSEL_UPDATED_EVENT = "ecs:hero-carousel-updated";

function mountHeroCarousel(root: HTMLElement) {
  const viewport = root.querySelector<HTMLElement>("[data-promo-viewport]");
  const dots = root.querySelector<HTMLElement>("[data-promo-dots]");
  if (!viewport || !dots) return;

  let embla: EmblaCarouselType | undefined;

  const render = () => {
    if (!embla) return;
    const selected = embla.selectedScrollSnap();
    const snaps = embla.scrollSnapList();
    dots.replaceChildren(...snaps.map((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.dataset.promoDot = String(index);
      dot.setAttribute("aria-label", `Show featured product ${index + 1}`);
      if (index === selected) dot.setAttribute("aria-current", "true");
      return dot;
    }));
    dots.hidden = snaps.length < 2;
    root.querySelectorAll<HTMLElement>("[data-promo-slide]").forEach((slide, index) => {
      slide.setAttribute("aria-hidden", String(index !== selected));
    });
  };

  embla = EmblaCarousel(viewport, {
    align: "start",
    containScroll: "trimSnaps",
    dragFree: false,
    loop: false,
    skipSnaps: false,
  });
  embla.on("init", render).on("reInit", render).on("select", render);

  dots.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("[data-promo-dot]")
      : null;
    if (!target) return;
    const index = Number.parseInt(target.dataset.promoDot ?? "", 10);
    if (Number.isInteger(index)) embla?.scrollTo(index);
  });

  root.addEventListener(CAROUSEL_UPDATED_EVENT, () => {
    embla?.reInit();
    embla?.scrollTo(0, true);
    render();
  });
  render();
}

export function initHeroCarousels() {
  document.querySelectorAll<HTMLElement>("[data-promo-carousel]").forEach(mountHeroCarousel);
}

