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
    syncTouch: true,
    touchMultiplier: 1,
  });
  const onScroll = () => ScrollTrigger.update();
  const onTick = (time: number) => lenis.raf(time * 1000);
  lenis.on("scroll", onScroll);
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);

  const context = gsap.context(() => {
    const heroItems = gsap.utils.toArray<HTMLElement>(
      ".lv-hero__copy > h1, .lv-hero__copy > p, .lv-hero__copy > .lv-button, .lv-hero__copy > ul",
    );
    if (heroItems.length) {
      gsap.from(heroItems, {
        autoAlpha: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
        y: 28,
      });
    }
    gsap.from(".lv-hero__portrait", {
      autoAlpha: 0,
      duration: 1.15,
      ease: "power3.out",
      scale: 1.025,
    });

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
    gsap.ticker.remove(onTick);
    lenis.destroy();
  };
}
