import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { responsiveClamp } from "./utils";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

// Register authentic Figma motion curves from node 785:11320
if (!CustomEase.get("figmaY")) {
  CustomEase.create("figmaY", "M0,0 C0,0 0.528,1.073 1,1");
}
if (!CustomEase.get("figmaScale")) {
  CustomEase.create("figmaScale", "M0,0 C0.597,0.221 0.5,1 1,1");
}
if (!CustomEase.get("figmaOpacity")) {
  CustomEase.create("figmaOpacity", "M0,0 C0.5,0 0.5,1 1,1");
}

export type FadeDirection = "toTop" | "toBottom" | "toLeft" | "toRight";

export const fadePresets = {
  "fade-1": {
    autoAlpha: 0,
    y: () => responsiveClamp(22, 36),
    duration: 0.75,
    ease: "power3.out",
    clearProps: "transform",
  },
  "fade-2": {
    autoAlpha: 0,
    y: () => responsiveClamp(32, 52),
    scale: 0.97,
    duration: 0.85,
    ease: "power3.out",
    clearProps: "transform",
  },
  "fade-3": {
    autoAlpha: 0,
    x: () => responsiveClamp(36, 60),
    duration: 0.75,
    ease: "power4.inOut",
    clearProps: "transform",
  },
  "fade-subtle": {
    autoAlpha: 0,
    y: () => responsiveClamp(12, 18),
    duration: 0.55,
    ease: "power2.out",
    clearProps: "transform",
  },
  "fade-scale": {
    autoAlpha: 0,
    scale: 0.94,
    y: () => responsiveClamp(14, 24),
    duration: 0.75,
    ease: "back.out(1.3)",
    clearProps: "transform",
  },
  "fade-btn": {
    autoAlpha: 0,
    y: () => responsiveClamp(14, 20),
    duration: 0.5,
    ease: "power2.inOut",
    clearProps: "transform",
  },
} satisfies Record<string, gsap.TweenVars>;

export type FadePresetName = keyof typeof fadePresets;

export interface HeaderAnimationOptions {
  stagger?: number;
  duration?: number;
  scrollTrigger?: boolean | gsap.DOMTarget | ScrollTrigger.Vars;
}

export interface BodyAnimationOptions {
  stagger?: number;
  duration?: number;
  scrollTrigger?: boolean | gsap.DOMTarget | ScrollTrigger.Vars;
}

export interface LinkHoverAnimationOptions {
  stagger?: number;
  duration?: number;
  ease?: string;
}

export interface TextAnimations {
  headerAnimation: (
    el: gsap.DOMTarget,
    staggerValue?: number,
    durationValue?: number,
    options?: HeaderAnimationOptions,
  ) => gsap.core.Tween | gsap.core.Timeline | undefined;
  bodyAnimation: (
    el: gsap.DOMTarget,
    staggerValue?: number,
    durationValue?: number,
    options?: BodyAnimationOptions,
  ) => gsap.core.Tween | gsap.core.Timeline | undefined;
  linkAnimation: (
    el: gsap.DOMTarget,
    staggerValue?: number,
    durationValue?: number,
    options?: LinkHoverAnimationOptions,
  ) => gsap.core.Timeline | undefined;
}

const fadeDirections = new Set<FadeDirection>(["toTop", "toBottom", "toLeft", "toRight"]);

export function headerWordAnimation(
  el: gsap.DOMTarget,
  staggerValue = 0.1,
  durationValue = 0.6,
  options?: HeaderAnimationOptions,
): gsap.core.Timeline | undefined {
  const target =
    typeof el === "string" ? document.querySelector<HTMLElement>(el) : (el as HTMLElement | null);
  if (!target) return undefined;

  const splitInstance = SplitText.create(target, {
    type: "words",
  });

  // Query all inline elements and SplitText words in precise reading/DOM order
  const allItems = Array.from(target.querySelectorAll<HTMLElement>("div, span")).filter((item) => {
    // Keep SplitText word spans and standalone inline elements (like badge & highlight)
    const isWord = splitInstance.words.includes(item);
    const isCustomInline =
      item.classList.contains("hero__badge") ||
      item.classList.contains("hero__highlight") ||
      item.hasAttribute("data-word");
    return isWord || isCustomInline;
  });

  // Fallback to splitInstance.words if none matched
  const targets = allItems.length > 0 ? allItems : (splitInstance.words as HTMLElement[]);

  // Instantly hide targets BEFORE revealing the target element
  gsap.set(targets, {
    opacity: 0,
    y: 28,
    scale: 0.85,
    transformOrigin: "bottom left",
  });

  gsap.set(target, { visibility: "visible" });

  const scrollTriggerConfig = options?.scrollTrigger
    ? typeof options.scrollTrigger === "object" && !(options.scrollTrigger instanceof Element)
      ? {
          trigger: target,
          start: "top 85%",
          once: true,
          ...options.scrollTrigger,
        }
      : {
          trigger:
            options.scrollTrigger === true ? target : (options.scrollTrigger as gsap.DOMTarget),
          start: "top 85%",
          once: true,
        }
    : undefined;

  const tl = gsap.timeline({
    scrollTrigger: scrollTriggerConfig,
    onComplete: () => {
      if (splitInstance) splitInstance.revert();
    },
  });

  tl.to(targets, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: durationValue,
    stagger: staggerValue,
    ease: "power3.out",
    clearProps: "transform",
  });

  return tl;
}

export function bodyLineAnimation(
  el: gsap.DOMTarget,
  staggerValue = 0.2,
  durationValue = 0.9,
  options?: BodyAnimationOptions,
): gsap.core.Timeline | undefined {
  const target =
    typeof el === "string" ? document.querySelector<HTMLElement>(el) : (el as HTMLElement | null);
  if (!target) return undefined;

  const splitInstance = SplitText.create(target, {
    type: "lines",
    mask: "lines",
  });

  // Instantly hide lines BEFORE revealing the target element
  gsap.set(splitInstance.lines, {
    opacity: 0,
    yPercent: 100,
  });

  gsap.set(target, { visibility: "visible" });

  const scrollTriggerConfig = options?.scrollTrigger
    ? typeof options.scrollTrigger === "object" && !(options.scrollTrigger instanceof Element)
      ? {
          trigger: target,
          start: "top 90%",
          once: true,
          ...options.scrollTrigger,
        }
      : {
          trigger:
            options.scrollTrigger === true ? target : (options.scrollTrigger as gsap.DOMTarget),
          start: "top 90%",
          once: true,
        }
    : undefined;

  const tl = gsap.timeline({
    scrollTrigger: scrollTriggerConfig,
  });

  tl.to(splitInstance.lines, {
    opacity: 1,
    yPercent: 0,
    duration: durationValue,
    stagger: staggerValue,
    ease: "power3.out",
    clearProps: "transform",
  });

  return tl;
}

export function hoverRollAnimation(
  el: gsap.DOMTarget,
  staggerValue = 0.02,
  durationValue = 0.55,
  options?: LinkHoverAnimationOptions,
): gsap.core.Timeline | undefined {
  const target =
    typeof el === "string" ? document.querySelector<HTMLElement>(el) : (el as HTMLElement | null);
  if (!target) return undefined;

  if (target.hasAttribute("data-hover-initialized")) return undefined;
  target.setAttribute("data-hover-initialized", "true");

  gsap.set(target, { visibility: "visible" });

  const split = SplitText.create(target, {
    type: "chars",
    smartWrap: true,
    mask: "chars",
  });

  split.chars.forEach((charEl) => {
    const text = charEl.textContent ?? "";
    charEl.innerHTML = "";
    const ogDiv = document.createElement("div");
    ogDiv.className = "og-char";
    ogDiv.textContent = text;
    const dupDiv = document.createElement("div");
    dupDiv.className = "duplicate-char";
    dupDiv.textContent = text;
    charEl.appendChild(ogDiv);
    charEl.appendChild(dupDiv);
  });

  const hoverTl = gsap.timeline({ paused: true });

  hoverTl.to(split.chars, {
    yPercent: -100,
    stagger: {
      amount: options?.stagger ?? Math.min(0.18, split.chars.length * staggerValue),
    },
    ease: options?.ease ?? "power3.out",
    duration: durationValue,
    delay: 0.2,
  });

  const triggerEl = target.closest("a, button") ?? target;

  triggerEl.addEventListener("mouseenter", () => {
    hoverTl.timeScale(1).play();
  });
  triggerEl.addEventListener("mouseleave", () => {
    hoverTl.timeScale(1.35).reverse();
  });

  return hoverTl;
}

export const textAnimations: TextAnimations = {
  headerAnimation: headerWordAnimation,
  bodyAnimation: bodyLineAnimation,
  linkAnimation: hoverRollAnimation,
};

export function animateText(
  el: gsap.DOMTarget,
  staggerValue?: number,
  durationValue?: number,
  options?: HeaderAnimationOptions | BodyAnimationOptions | LinkHoverAnimationOptions,
): gsap.core.Tween | gsap.core.Timeline | undefined {
  const targetEl =
    typeof el === "string" ? document.querySelector<HTMLElement>(el) : (el as HTMLElement | null);
  const animType = targetEl?.dataset?.textAnim as keyof TextAnimations | undefined;
  if (animType === "headerAnimation") {
    return headerWordAnimation(el, staggerValue, durationValue, options as HeaderAnimationOptions);
  }
  if (animType === "bodyAnimation") {
    return bodyLineAnimation(el, staggerValue, durationValue, options as BodyAnimationOptions);
  }
  if (animType === "linkAnimation") {
    return hoverRollAnimation(
      el,
      staggerValue,
      durationValue,
      options as LinkHoverAnimationOptions,
    );
  }
  return undefined;
}

export function getFadeVars(
  direction: FadeDirection = "toTop",
  presetName: FadePresetName = "fade-1",
): gsap.TweenVars {
  const preset = fadePresets[presetName] ?? fadePresets["fade-1"];
  const tweenVars: gsap.TweenVars = { ...preset };
  const resolveVal = (val: unknown) =>
    typeof val === "function" ? (val as () => number)() : typeof val === "number" ? val : 32;

  const presetRecord = preset as Record<string, unknown>;
  const getDistance = () => {
    const rawDist = resolveVal(presetRecord.y) ?? resolveVal(presetRecord.x) ?? 32;
    return Math.abs(Number(rawDist) || 32);
  };

  if (direction === "toLeft" || direction === "toRight") {
    tweenVars.x = () => (direction === "toLeft" ? getDistance() : -getDistance());
    delete tweenVars.y;
  } else {
    tweenVars.y = () => (direction === "toTop" ? getDistance() : -getDistance());
    delete tweenVars.x;
  }

  delete tweenVars.yPercent;
  delete tweenVars.xPercent;
  tweenVars.clearProps = tweenVars.clearProps ?? "transform";

  return tweenVars;
}

export function animateFadeIn(
  el: gsap.DOMTarget,
  direction: FadeDirection = "toTop",
  presetName: FadePresetName = "fade-1",
  scrollTriggerValue: gsap.DOMTarget | object | null = null,
): gsap.core.Tween | undefined {
  const targetEl =
    typeof el === "string" ? document.querySelector<HTMLElement>(el) : (el as HTMLElement | null);
  if (!targetEl) return undefined;

  const tweenVars = getFadeVars(direction, presetName);
  if (scrollTriggerValue) {
    tweenVars.scrollTrigger = scrollTriggerValue as gsap.TweenVars["scrollTrigger"];
  }

  return gsap.from(targetEl, tweenVars);
}

export function initGlobalFadeIns(): void {
  document.querySelectorAll<HTMLElement>('[data-fade-in^="st"]').forEach((el) => {
    const parts = el.dataset.fadeIn?.split(":") ?? [];
    const presetName =
      parts[1] && parts[1] in fadePresets ? (parts[1] as FadePresetName) : "fade-1";
    const direction =
      parts[2] && fadeDirections.has(parts[2] as FadeDirection)
        ? (parts[2] as FadeDirection)
        : "toTop";

    animateFadeIn(el, direction, presetName, {
      trigger: el,
      start: "top 90%",
      once: true,
      invalidateOnRefresh: true,
    });
  });
}

export function initGlobalTextAnimations(): void {
  document.querySelectorAll<HTMLElement>("[data-text-anim], [data-hover-roll]").forEach((el) => {
    if (el.hasAttribute("data-hover-roll")) {
      hoverRollAnimation(el);
      return;
    }

    const animType = el.dataset.textAnim;
    if (!animType || animType.startsWith("tl:")) return;

    if (animType === "headerAnimation" || animType === "headerWordAnimation") {
      headerWordAnimation(el, undefined, undefined, {
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true,
          invalidateOnRefresh: true,
        },
      });
    } else if (animType === "bodyAnimation" || animType === "bodyLineAnimation") {
      bodyLineAnimation(el, undefined, undefined, {
        scrollTrigger: {
          trigger: el,
          start: "top 90%",
          once: true,
          invalidateOnRefresh: true,
        },
      });
    } else if (animType === "linkAnimation" || animType === "hoverRollAnimation") {
      hoverRollAnimation(el);
    }
  });

  initButtonEffects();
}

export function initButtonEffects(): void {
  const iconButtons = document.querySelectorAll<HTMLElement>(".btn--with-icon");
  if (!iconButtons.length) return;

  const updateTravel = (btn: HTMLElement) => {
    const icon = btn.querySelector<HTMLElement>(".btn__icon-wrapper");
    if (!icon) return;
    const isSmall = btn.classList.contains("btn--small");
    const isMobile = window.innerWidth <= 540;
    const targetLeft = isMobile ? (isSmall ? 2 : 3) : 4;
    const travelDistance = icon.offsetLeft - targetLeft;
    if (travelDistance > 0) {
      btn.style.setProperty("--icon-travel", `${travelDistance}px`);
    }
  };

  iconButtons.forEach((btn) => {
    updateTravel(btn);
    btn.addEventListener("mouseenter", () => updateTravel(btn), { passive: true });
  });

  window.addEventListener(
    "resize",
    () => {
      iconButtons.forEach(updateTravel);
    },
    { passive: true },
  );
}

export function revealAnimationTargets(): void {
  gsap.set("[data-text-anim], [data-fade-in], [data-hover-roll], .pain__bubble", {
    visibility: "visible",
  });
}
