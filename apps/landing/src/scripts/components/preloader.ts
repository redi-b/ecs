import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { bodyLineAnimation, headerWordAnimation } from "../common";
import { prefersReducedMotion } from "../utils";

gsap.registerPlugin(CustomEase);

// Register custom eases
if (!CustomEase.get("stutterEase")) {
  CustomEase.create(
    "stutterEase",
    "M0,0 C0,0 0.052,0.1 0.152,0.1 0.242,0.1 0.299,0.349 0.399,0.349 0.586,0.349 0.569,0.596 0.67,0.624 0.842,0.671 0.95,0.95 1,1",
  );
}

if (!CustomEase.get("topCardExit")) {
  CustomEase.create("topCardExit", "M0,0 C0.4,-0.18 0.6,-0.05 0.75,0.15 C0.85,0.32 0.92,0.68 1,1");
}

export function initPreloader(onComplete: () => void): gsap.core.Timeline | undefined {
  const preloader = document.querySelector<HTMLElement>(".preloader");
  if (!preloader) {
    onComplete();
    return undefined;
  }

  const topCard = preloader.querySelector<HTMLElement>(".preloader__top-card");
  const logo = preloader.querySelector<HTMLElement>("[data-preloader-logo]");
  const title = preloader.querySelector<HTMLElement>(".preloader__title");
  const subtitle = preloader.querySelector<HTMLElement>(".preloader__subtitle");
  const progressGroup = preloader.querySelector<HTMLElement>(".preloader__progress-group");
  const progressFill = preloader.querySelector<HTMLElement>(".preloader__progress-fill");
  const loadingText = preloader.querySelector<HTMLElement>(".preloader__loading-text");
  const loadingPct = preloader.querySelector<HTMLElement>(".preloader__loading-pct");

  if (prefersReducedMotion()) {
    gsap.set(preloader, { display: "none" });
    onComplete();
    return undefined;
  }

  // Initial setup: ensure elements are in starting state
  if (topCard) {
    gsap.set(topCard, {
      transformOrigin: "top",
    });
  }

  if (progressGroup) {
    gsap.set(progressGroup, {
      y: 35,
      opacity: 0,
    });
  }

  if (progressFill) {
    gsap.set(progressFill, {
      width: "0%",
    });
  }

  if (logo) {
    gsap.set(logo, {
      opacity: 0,
      y: 20,
    });
  }

  const masterTl = gsap.timeline({
    defaults: { ease: "power3.out" },
  });

  // 1. Animate scaleY of preloader__top-card from 0 to 1
  if (topCard) {
    masterTl.to(topCard, {
      scaleY: 1,
      duration: 0.9,
      ease: "expo.out(1.6)",
    });
  }

  // 2. Concurrently fade in preloader__progress-group from bottom up with smooth bouncy ease
  if (progressGroup) {
    masterTl.set(progressGroup, { visibility: "visible" }, "<0.1").to(
      progressGroup,
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "back.out(1.6)",
      },
      "<",
    );
  }

  // 3. Kick off top card contents reveal & progress bar after entrance finishes
  masterTl.add(() => {
    // A. Logo fades in from bottom up (no blur)
    if (logo) {
      gsap.set(logo, { visibility: "visible" });
      gsap.to(logo, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "power2.out",
      });
    }

    // B. Title animates using header animation (word-based Figma motion)
    if (title) {
      headerWordAnimation(title, 0.1, 0.48);
    }

    // C. After 0.5s of title starting, kickoff body text animation for subheadline
    if (subtitle) {
      gsap.delayedCall(0.5, () => {
        bodyLineAnimation(subtitle, 0.035, 0.75);
      });
    }
  }, "+=0.05");

  // 4. Concurrently start progress bar animation from 0% with stutterEase (25% faster)
  const progressObj = { value: 0 };

  if (progressFill) {
    masterTl.to(
      progressFill,
      {
        width: "100%",
        duration: 1.8,
        ease: "stutterEase",
      },
      "<",
    );
  }

  masterTl.to(
    progressObj,
    {
      value: 100,
      duration: 1.8,
      ease: "stutterEase",
      onUpdate: () => {
        const pct = Math.round(progressObj.value);
        if (loadingPct) {
          loadingPct.textContent = `${pct}%`;
        } else if (loadingText) {
          loadingText.textContent = `Loading ${pct}%`;
        }
      },
    },
    "<",
  );

  // 5. Once progress bar finishes animating:
  // A. Hide progress-group to bottom using bouncy ease
  if (progressGroup) {
    masterTl.to(
      progressGroup,
      {
        y: 40,
        opacity: 0,
        duration: 0.5,
        ease: "back.in(1.5)",
      },
      "+=0.1",
    );
  }

  // B. Top-card contents fade out with stagger
  const topCardContents = [logo, title, subtitle].filter(Boolean) as HTMLElement[];
  if (topCardContents.length) {
    masterTl.to(
      topCardContents,
      {
        opacity: 0,
        y: -16,
        duration: 0.45,
        stagger: 0.06,
        ease: "power2.in",
      },
      "<",
    );
  }

  // 6. Top-card element animates to scaleY of 2 (faster towards end) and borderRadius to 0
  if (topCard) {
    masterTl.to(
      topCard,
      {
        scaleY: 2,
        borderRadius: "0px",
        duration: 0.6,
        ease: "topCardExit",
      },
      "+=0.02",
    );
  }

  // 7. Remove preloader from view and trigger seamless Hero reveal
  masterTl.add(() => {
    gsap.set(preloader, { display: "none" });
    onComplete();
  });

  return masterTl;
}
