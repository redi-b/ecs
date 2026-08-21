import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let cleanup: (() => void) | undefined;

export function initLuviaMotion() {
  cleanup?.();

  const editorMode = document.body.dataset.editorMode === "true";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (editorMode || reducedMotion) return;

  ScrollTrigger.config({ ignoreMobileResize: true });
  const lenis = new Lenis({
    anchors: true,
    lerp: 0.08,
    smoothWheel: true,
    syncTouch: false,
    prevent: (node) => {
      return Boolean(
        node instanceof Element &&
          (node.hasAttribute("data-lenis-prevent") ||
            node.closest("[data-lenis-prevent], [data-cart-drawer], .lv-cart-drawer, .lv-nav") !== null),
      );
    },
  });
  const onScroll = () => ScrollTrigger.update();
  const onTick = (time: number) => lenis.raf(time * 1000);
  lenis.on("scroll", onScroll);
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);
  const onOverlayLockChange = (event: Event) => {
    const locked = event instanceof CustomEvent && event.detail?.locked === true;
    if (locked) lenis.stop();
    else lenis.start();
  };
  window.addEventListener("ecs:overlay-lock-change", onOverlayLockChange);

  const context = gsap.context(() => {
    gsap.utils.toArray<HTMLElement>(
      ".lv-story, .lv-top-picks, .lv-products, .lv-statement, .lv-about, .lv-categories, .lv-cta",
    ).forEach((section) => {
      gsap.from(section, {
        autoAlpha: 0,
        duration: 0.9,
        ease: "power3.out",
        filter: "blur(4px)",
        scrollTrigger: {
          trigger: section,
          start: "top 88%",
          once: true,
        },
        y: 34,
      });
    });
  });

  cleanup = () => {
    context.revert();
    window.removeEventListener("ecs:overlay-lock-change", onOverlayLockChange);
    gsap.ticker.remove(onTick);
    lenis.destroy();
  };
}
