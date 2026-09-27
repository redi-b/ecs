import { gsap } from "gsap";

export function responsiveClamp(
  minValue: number,
  maxValue: number,
  minScreen = 350,
  maxScreen = 1450,
): number {
  const map = gsap.utils.mapRange(minScreen, maxScreen, minValue, maxValue);
  const clamp = gsap.utils.clamp(minValue, maxValue);
  return Math.round(clamp(map(window.innerWidth)) * 100) / 100;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function whenPageReady(callback: () => void): void {
  const run = () => {
    const fonts = "fonts" in document ? document.fonts : undefined;

    if (fonts?.ready) {
      fonts.ready.then(callback);
      return;
    }

    callback();
  };

  if (document.readyState === "complete") {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
}
