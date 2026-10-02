import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { initAuthAwareCtas } from "./auth-aware-cta";
import { initGlobalFadeIns, initGlobalTextAnimations } from "./common";
import { initPreloader } from "./components/preloader";
import {
  initCtaSection,
  initFeaturesSection,
  initFooterSection,
  initHeroSection,
  initPainSection,
  initPricingSection,
  initShopSection,
  initStepsSection,
  initStorefrontSection,
  initTemplatesSection,
} from "./pages/home";
import { whenPageReady } from "./utils";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

ScrollTrigger.config({
  ignoreMobileResize: true,
});

gsap.defaults({
  duration: 0.8,
  ease: "power3.out",
});

let animationContext: gsap.Context | undefined;

const lenis: Lenis = new Lenis({
  lerp: 0.08,
  smoothWheel: true,
  syncTouch: true,
  touchMultiplier: 1,
  anchors: true,
});

if (lenis) {
  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

function initAnimationLayer(): void {
  void initAuthAwareCtas();
  animationContext?.revert();

  animationContext = gsap.context(() => {
    const preloaderEl = document.querySelector<HTMLElement>(".preloader");

    // 1. Initialize Hero timeline early (paused so elements snap to hidden states behind preloader)
    const heroTimeline = initHeroSection();

    // 2. Initialize Pain section ScrollTrigger animations
    initPainSection();

    // 3. Initialize Features Split section ScrollTrigger animations
    initFeaturesSection();

    // 4. Initialize Storefront Features section animations
    initStorefrontSection();

    // 5. Initialize Shop Features section animations
    initShopSection();

    // 6. Initialize Steps Section wizard scroll animations
    initStepsSection();

    // 7. Initialize Templates carousel and section animations
    initTemplatesSection();

    // 8. Initialize Pricing section entrance and cards stagger animations
    initPricingSection();

    // 9. Initialize CTA Section entrance & parallax animations
    initCtaSection();

    // 10. Initialize Footer section multi-element entrance animations
    initFooterSection();

    // 11. Initialize global standalone fade-ins and text animations (tl: elements are ignored)
    initGlobalFadeIns();
    initGlobalTextAnimations();

    // 3. Coordinate Preloader
    if (preloaderEl) {
      lenis?.stop();
      document.body.classList.add("no-scroll");

      initPreloader(() => {
        document.body.classList.remove("no-scroll");
        lenis?.start();
        if (heroTimeline) {
          heroTimeline.play();
        }
        ScrollTrigger.refresh();
      });
    } else {
      if (heroTimeline) heroTimeline.play();
      ScrollTrigger.refresh();
    }
  });
}

whenPageReady(initAnimationLayer);

export { gsap, lenis, ScrollTrigger };
