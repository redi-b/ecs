import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Swiper from "swiper";
import { A11y, Keyboard, Navigation, Pagination } from "swiper/modules";
import { bodyLineAnimation, getFadeVars, headerWordAnimation } from "../common";
import { responsiveClamp } from "../utils";

gsap.registerPlugin(ScrollTrigger);

export function initHeroSection(): gsap.core.Timeline | undefined {
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero) return undefined;

  const heroBg = hero.querySelector<HTMLElement>(".hero__bg");
  const heroTitle = hero.querySelector<HTMLElement>(".hero__title");
  const heroDesc = hero.querySelector<HTMLElement>(".hero__desc");
  const heroCtaGroup = hero.querySelector<HTMLElement>("[data-hero-cta]");
  const heroCardImgs = hero.querySelectorAll<HTMLElement>(".hero__arc .hero__card-img");

  // Dynamically arrange floating arc cards via JS using responsive CSS variables
  setupHeroArcLayout();

  // Hero CTA elements
  const ctaSocialProof = heroCtaGroup?.querySelector<HTMLElement>(".hero__social-proof");
  const ctaDivider = heroCtaGroup?.querySelector<HTMLElement>(".hero__divider");
  const ctaBtn = heroCtaGroup?.querySelector<HTMLElement>(".btn");

  const header = document.querySelector<HTMLElement>(".header");
  const headerMain = header?.querySelector<HTMLElement>(".header__main");
  const headerBrandWrapper = header?.querySelector<HTMLElement>(".header__brand-wrapper");
  const headerToggle = header?.querySelector<HTMLElement>(".header__toggle");
  const headerDivider = header?.querySelector<HTMLElement>(".header__divider");
  const headerLogo = header?.querySelector<HTMLElement>(".header__logo");
  const headerActionBtns = header?.querySelectorAll<HTMLElement>(".header__actions .btn");
  const headerMarquee = header?.querySelector<HTMLElement>(".header__marquee");

  // Shared fade-btn preset vars (reads from the same preset declared in data-fade-in="tl:fade-btn")
  const fadeBtnVars = getFadeVars("toTop", "fade-btn");

  // Create a PAUSED timeline early to immediately snap elements to initial hidden states
  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: "power3.out" },
  });

  // Snap all initial states behind the preloader
  if (heroBg) {
    gsap.set(heroBg, {
      opacity: 0,
      scale: 1.15,
      transformOrigin: "center top",
    });
  }

  if (header) {
    gsap.set(header, {
      visibility: "visible",
      opacity: 1,
    });
  }

  if (headerMain) {
    gsap.set(headerMain, {
      scaleX: 0,
      opacity: 1,
      transformOrigin: "center center",
    });
  }

  if (headerBrandWrapper) {
    gsap.set(headerBrandWrapper, {
      opacity: 0,
      scale: 0.92,
      transformOrigin: "center center",
    });
  }

  if (headerToggle) {
    gsap.set(headerToggle, {
      opacity: 0,
      scale: 0.6,
      transformOrigin: "center center",
    });
  }

  if (headerDivider) {
    gsap.set(headerDivider, {
      opacity: 0,
      scaleY: 0,
      transformOrigin: "center center",
    });
  }

  if (headerLogo) {
    gsap.set(headerLogo, {
      opacity: 0,
      x: -12,
    });
  }

  if (headerMarquee) {
    gsap.set(headerMarquee, {
      opacity: 0,
      y: -28,
    });
  }

  // Hero CTA initial states
  if (heroCtaGroup) {
    gsap.set(heroCtaGroup, { visibility: "visible", opacity: 1 });
  }

  if (ctaDivider) {
    gsap.set(ctaDivider, {
      opacity: 0,
      scaleY: 0,
      transformOrigin: "center center",
    });
  }

  // Hero arc cards initial state (prevents ghost borders/shadows before animation)
  if (heroCardImgs.length) {
    gsap.set(heroCardImgs, {
      opacity: 0,
      y: 45,
      scale: 0.82,
      transformOrigin: "center center",
    });
  }

  // 1. Hero background image layer smoothly dissolves in
  if (heroBg) {
    tl.to(
      heroBg,
      {
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: "power2.out",
      },
      0,
    );
  }

  // 2. Navbar expands with scaleX (centered, GPU accelerated)
  if (headerMain) {
    tl.to(
      headerMain,
      {
        scaleX: 1,
        duration: 0.65,
        ease: "power3.out",
      },
      0.1,
    );
  }

  // 3. Navbar contents animate individually after the navbar expands
  if (headerBrandWrapper) {
    tl.to(
      headerBrandWrapper,
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
      },
      0.45,
    );
  }

  if (headerToggle) {
    tl.to(
      headerToggle,
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
      },
      0.5,
    );
  }

  if (headerDivider) {
    tl.to(
      headerDivider,
      {
        opacity: 1,
        scaleY: 1,
        duration: 0.35,
        ease: "power2.out",
      },
      0.55,
    );
  }

  if (headerLogo) {
    tl.to(
      headerLogo,
      {
        opacity: 1,
        x: 0,
        duration: 0.4,
        ease: "power2.out",
      },
      0.6,
    );
  }

  if (headerActionBtns?.length) {
    tl.from(
      headerActionBtns,
      {
        ...fadeBtnVars,
        stagger: 0.1,
      },
      0.42,
    );
  }

  // 4. Header marquee drops down from behind the navbar
  if (headerMarquee) {
    tl.to(
      headerMarquee,
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "back.out(1.3)",
      },
      0.8,
    );
  }

  // 5. Hero title words & inline elements animate with Figma motion curves
  if (heroTitle) {
    const titleTl = headerWordAnimation(heroTitle, 0.05, 0.6);
    if (titleTl) {
      tl.add(titleTl, 0.35);
    }
  }

  // 6. Hero subtitle lines slide up using line SplitText reveal
  if (heroDesc) {
    const descTween = bodyLineAnimation(heroDesc, 0.08, 0.52);
    if (descTween) {
      tl.add(descTween, 0.62);
    }
  }

  // 7. Hero CTA group items fade up with stagger (starts after subheadline finishes)
  if (ctaSocialProof) {
    tl.from(ctaSocialProof, fadeBtnVars, "<.2");
  }

  if (ctaDivider) {
    tl.to(
      ctaDivider,
      {
        opacity: 1,
        scaleY: 1,
        duration: 0.3,
        ease: "power2.out",
      },
      "<.2",
    );
  }

  if (ctaBtn) {
    tl.from(ctaBtn, fadeBtnVars, "<");
  }

  const arcControl = initHeroArcRotation();

  // 8. 14 Floating template arc cards animate seamlessly as the wheel rotates
  if (heroCardImgs.length) {
    tl.to(
      heroCardImgs,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 0.05,
        ease: "back.out(1.2)",
      },
      "<-.5",
    );
  }

  // Start continuous rotation simultaneously so cards emerge onto an already smoothly turning wheel
  if (arcControl) {
    tl.call(
      () => {
        arcControl.start();
      },
      undefined,
      "<",
    );
  }

  // 9. Interactive hover for hero__badge (bag swings smoothly left, right, then settles)
  initHeroBadgeHover();

  return tl;
}

let heroBadgeHoverInitialized = false;

export function initHeroBadgeHover(): void {
  if (heroBadgeHoverInitialized) return;
  heroBadgeHoverInitialized = true;

  let swingTl: gsap.core.Timeline | null = null;

  document.addEventListener("mouseover", (e) => {
    const target = e.target as HTMLElement | null;
    const badge = target?.closest<HTMLElement>(".hero__badge");
    if (!badge) return;

    const related = (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>(".hero__badge");
    if (related === badge) return;

    const bag = badge.querySelector<SVGGraphicsElement>(".handbag__bag, .bag, [data-handbag-bag]");
    if (!bag) return;

    if (swingTl) swingTl.kill();
    swingTl = gsap.timeline();
    swingTl
      .to(bag, {
        rotation: -18,
        duration: 0.22,
        ease: "power2.out",
        svgOrigin: "62.5 23.8",
      })
      .to(bag, {
        rotation: 14,
        duration: 0.26,
        ease: "sine.inOut",
        svgOrigin: "62.5 23.8",
      })
      .to(bag, {
        rotation: -8,
        duration: 0.22,
        ease: "sine.inOut",
        svgOrigin: "62.5 23.8",
      })
      .to(bag, {
        rotation: 4,
        duration: 0.18,
        ease: "sine.inOut",
        svgOrigin: "62.5 23.8",
      })
      .to(bag, {
        rotation: 0,
        duration: 0.22,
        ease: "power2.out",
        svgOrigin: "62.5 23.8",
      });
  });
}

export interface HeroArcLayoutConfig {
  /** Total angle span for the circle distribution in degrees (default: 360) */
  totalAngle?: number;
  /** Index of the card positioned at the apex (0 degrees / top center) (default: 6 for the 7th card) */
  apexIndex?: number;
  /** Direction: 1 = clockwise, -1 = counter-clockwise (default: 1) */
  direction?: number;
  /** Angle offset in degrees (default: 0) */
  angleOffset?: number;
  /** Manual radius override in pixels (if not provided, reads CSS variable --arc-radius) */
  radius?: number;
}

export interface HeroArcLayoutControl {
  update: () => void;
  destroy: () => void;
  setConfig: (newConfig: Partial<HeroArcLayoutConfig>) => void;
}

let arcLayoutCleanup: (() => void) | null = null;

export function setupHeroArcLayout(
  config: HeroArcLayoutConfig = {},
): HeroArcLayoutControl | undefined {
  const hero = document.querySelector<HTMLElement>(".hero");
  const arc = hero?.querySelector<HTMLElement>(".hero__arc");
  const rotator = arc?.querySelector<HTMLElement>(".hero__arc-rotator");
  const cards = arc?.querySelectorAll<HTMLElement>(".hero__card");

  if (!hero || !arc || !rotator || !cards || !cards.length) return undefined;

  if (arcLayoutCleanup) {
    arcLayoutCleanup();
    arcLayoutCleanup = null;
  }

  const currentConfig: HeroArcLayoutConfig = {
    totalAngle: 360,
    apexIndex: 6,
    direction: 1,
    angleOffset: 0,
    ...config,
  };

  const applyLayout = () => {
    const totalCards = cards.length;
    const totalAngle = currentConfig.totalAngle ?? 360;
    const apexIndex = currentConfig.apexIndex ?? 6;
    const direction = currentConfig.direction ?? 1;
    const angleOffset = currentConfig.angleOffset ?? 0;
    const step = totalAngle / totalCards;

    if (typeof currentConfig.radius === "number" && currentConfig.radius > 0) {
      arc.style.setProperty("--arc-radius", `${currentConfig.radius}px`);
    }

    cards.forEach((card, i) => {
      const angle = (i - apexIndex) * step * direction + angleOffset;
      // Set dynamic angle and card index via CSS custom properties
      card.style.setProperty("--angle", `${angle.toFixed(4)}deg`);
      card.style.setProperty("--card-index", `${i}`);
      // Remove inline transform so CSS transform using var(--arc-radius) takes full effect
      card.style.removeProperty("transform");
    });
  };

  // Immediate initial calculation
  applyLayout();

  // Responsive dynamic recalculation on window resize and GSAP ScrollTrigger refresh
  let resizeTimer: number | null = null;
  const onResize = () => {
    if (resizeTimer) cancelAnimationFrame(resizeTimer);
    resizeTimer = requestAnimationFrame(applyLayout);
  };

  window.addEventListener("resize", onResize, { passive: true });
  ScrollTrigger.addEventListener("refresh", applyLayout);

  const destroy = () => {
    if (resizeTimer) cancelAnimationFrame(resizeTimer);
    window.removeEventListener("resize", onResize);
    ScrollTrigger.removeEventListener("refresh", applyLayout);
  };

  arcLayoutCleanup = destroy;

  return {
    update: applyLayout,
    destroy,
    setConfig: (newConfig: Partial<HeroArcLayoutConfig>) => {
      Object.assign(currentConfig, newConfig);
      applyLayout();
    },
  };
}

export interface HeroArcRotationControl {
  start: () => void;
  destroy: () => void;
}

let arcRotationCleanup: (() => void) | null = null;

export function initHeroArcRotation(): HeroArcRotationControl | undefined {
  const hero = document.querySelector<HTMLElement>(".hero");
  const arcRotator = hero?.querySelector<HTMLElement>(".hero__arc-rotator");
  if (!hero || !arcRotator) return undefined;

  // Clean up any existing ticker/trigger if re-initialized
  if (arcRotationCleanup) {
    arcRotationCleanup();
    arcRotationCleanup = null;
  }

  const BASE_SPEED = 1.4; // degrees per second (gentle, elegant idle rotation)
  const MAX_BOOST = 40; // refined ceiling for scroll acceleration
  const FRICTION = 0.9; // smooth, satisfying decay curve
  const ACCEL_LERP = 0.14; // smooth response when picking up speed
  const COAST_LERP = 0.052; // silky smooth easing when decelerating / coasting

  let currentRotation = 0;
  let currentSpeed = BASE_SPEED;
  let targetDirection = 1; // 1 = clockwise, -1 = counter-clockwise (remembers last scroll direction)
  let scrollBoost = 0;
  let isRotating = false;
  let isHeroVisible = true;

  // The center is fixed at 0 0 of the rotator in CSS (which sits at 50% radius)
  gsap.set(arcRotator, { transformOrigin: "0 0" });
  const setRotation = gsap.quickSetter(arcRotator, "rotation", "deg");

  // ScrollTrigger tracking velocity & direction with exponential power curve
  const scrollTracker = ScrollTrigger.create({
    onUpdate: (self) => {
      const velocity = self.getVelocity(); // px/s
      const absV = Math.abs(velocity);
      if (absV > 12) {
        targetDirection = velocity > 0 ? 1 : -1;

        // Exponential power curve: normalized velocity (0 to 1) raised to 1.35
        // Subtle and calm on gentle scrolls, swells powerfully on energetic scrolls
        const normV = Math.min(absV / 2600, 1);
        const expoBoost = normV ** 1.35 * MAX_BOOST;
        scrollBoost = Math.max(scrollBoost, expoBoost);

        // If user scrolls, activate rotation
        if (!isRotating && absV > 30) {
          isRotating = true;
        }
      }
    },
  });

  // Wheel event listener with calibrated exponential response for trackpad/mouse wheel
  const onWheel = (e: WheelEvent) => {
    const absDelta = Math.abs(e.deltaY);
    if (absDelta > 2) {
      targetDirection = e.deltaY > 0 ? 1 : -1;
      const normDelta = Math.min(absDelta / 200, 1);
      const wheelBoost = normDelta ** 1.35 * (MAX_BOOST * 0.65);
      scrollBoost = Math.max(scrollBoost, wheelBoost);
      if (!isRotating) {
        isRotating = true;
      }
    }
  };
  window.addEventListener("wheel", onWheel, { passive: true });

  // Visibility tracker to keep rotation active throughout hero AND pain section
  const painSection = document.querySelector<HTMLElement>(".pain");
  const endEl = painSection || hero;

  const visibilityTracker = ScrollTrigger.create({
    trigger: hero,
    start: "top bottom",
    endTrigger: endEl,
    end: "bottom top",
    onEnter: () => {
      isHeroVisible = true;
    },
    onLeave: () => {
      isHeroVisible = false;
    },
    onEnterBack: () => {
      isHeroVisible = true;
    },
    onLeaveBack: () => {
      isHeroVisible = false;
    },
  });

  const onTick = (_time: number, deltaTime: number) => {
    if (!isRotating) return;

    // Clamp dt to 33.3ms to avoid large jumps on tab blur/focus
    const dt = Math.min(deltaTime, 33.33) / 1000;

    // Decay scroll boost smoothly towards 0 with exciting, long-lasting friction
    scrollBoost *= FRICTION ** (dt * 60);

    // Target speed incorporating direction and boost
    const targetSpeed = (BASE_SPEED + scrollBoost) * targetDirection;

    // Dynamic responsiveness: quick pickup when accelerating, silky glide when coasting
    const isAccelerating =
      Math.abs(targetSpeed) > Math.abs(currentSpeed) &&
      Math.sign(targetSpeed) === Math.sign(currentSpeed);
    const activeLerp = isAccelerating ? ACCEL_LERP : COAST_LERP;
    const lerpAmt = 1 - (1 - activeLerp) ** (dt * 60);
    currentSpeed += (targetSpeed - currentSpeed) * lerpAmt;

    // Accumulate rotation angle
    currentRotation += currentSpeed * dt;

    // Keep angle normalized within [-360, 360]
    if (currentRotation >= 360) currentRotation -= 360;
    if (currentRotation <= -360) currentRotation += 360;

    // Only update DOM when visible in viewport
    if (isHeroVisible) {
      setRotation(currentRotation);
    }
  };

  gsap.ticker.add(onTick);

  const destroy = () => {
    gsap.ticker.remove(onTick);
    window.removeEventListener("wheel", onWheel);
    scrollTracker.kill();
    visibilityTracker.kill();
  };

  arcRotationCleanup = destroy;

  return {
    start: () => {
      isRotating = true;
    },
    destroy,
  };
}

export function initPainSection(): void {
  const pain = document.querySelector<HTMLElement>(".pain");
  if (!pain) return;

  const painTitle = pain.querySelector<HTMLElement>(".pain__title");
  const painVisualCol = pain.querySelector<HTMLElement>(".pain__visual-col");
  const painBubbles = pain.querySelectorAll<HTMLElement>(".pain__bubble");
  const painCopyCol = pain.querySelector<HTMLElement>(".pain__copy-col");
  const painCopy = pain.querySelector<HTMLElement>(".pain__copy");
  const painBtn = painCopyCol?.querySelector<HTMLElement>(".btn");
  const videoRow = pain.querySelector<HTMLElement>(".pain__video-row");
  const demoVideo = pain.querySelector<HTMLElement>(".pain__video");
  const videoArrow = pain.querySelector<HTMLElement>(".pain__video-arrow");
  const videoText = pain.querySelector<HTMLElement>(".pain__video-text");

  if (painBubbles.length) {
    gsap.set(painBubbles, {
      autoAlpha: 0,
      scale: 0.65,
      y: 20,
    });
  }

  // Demo video starts at scale 0.5 from top center
  if (demoVideo) {
    gsap.set(demoVideo, {
      scale: 0.5,
      transformOrigin: "top center",
    });
  }

  const hintElements = [videoArrow, videoText].filter(Boolean) as HTMLElement[];
  if (hintElements.length) {
    gsap.set(hintElements, {
      autoAlpha: 0,
    });
  }

  // 1. Timeline 1: H2 text animation & Media animation (whole image fade up + chat bubbles with stagger)
  // Triggers only once user scrolls down to the section (top 50% = middle of viewport)
  const mainTl = gsap.timeline({
    scrollTrigger: {
      trigger: pain,
      start: "top 50%",
      once: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: "power3.out" },
  });

  // A. H2 word animation - triggered cleanly within timeline so SplitText doesn't expose text early
  if (painTitle) {
    mainTl.add(() => {
      headerWordAnimation(painTitle, 0.025, 0.45);
    }, 0.5);
  }

  // B. Middle media (whole image / backdrop) fades up
  if (painVisualCol) {
    mainTl.from(painVisualCol, getFadeVars("toTop", "fade-2"), 0.15);
  }

  // C. Floating chat bubbles popping in with playful stagger
  if (painBubbles.length) {
    mainTl.to(
      painBubbles,
      {
        autoAlpha: 1,
        scale: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.18,
        ease: "back.out(1.5)",
        clearProps: "transform",
      },
      0.38,
    );
  }

  // 2. Timeline 2: Narrative copy & CTA button with a separate ScrollTrigger
  // Separate trigger for mobile/tablet where copy gets pushed below media
  if (painCopyCol) {
    const copyTl = gsap.timeline({
      scrollTrigger: {
        trigger: painCopyCol,
        start: "top 70%",
        once: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "power3.out" },
    });

    if (painCopy) {
      copyTl.add(() => {
        bodyLineAnimation(painCopy, 0.08, 0.52);
      }, 0);
    }

    if (painBtn) {
      copyTl.from(painBtn, getFadeVars("toTop", "fade-btn"), 0.25);
    }
  }

  // 3. Timeline 3: Demo video scrubbed scale-up (0.5 -> 1) from top center and hint reveal
  if (videoRow && demoVideo) {
    const videoTl = gsap.timeline({
      scrollTrigger: {
        trigger: videoRow,
        start: "top 70%",
        end: "bottom 50%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "expo.out" },
    });

    videoTl
      .to(demoVideo, {
        scale: 1,
        transformOrigin: "top center",
        duration: 1,
      })
      .to(
        hintElements,
        {
          autoAlpha: 1,
          duration: 0.35,
          stagger: 0.1,
          ease: "power2.out",
        },
        "-=.8",
      );
  }
}

export function initFeaturesSection(): void {
  const features = document.querySelector<HTMLElement>(".features");
  if (!features) return;

  // 1. Storefront Row (.features__row--storefront)
  const storefrontRow = features.querySelector<HTMLElement>(".features__row--storefront");
  if (storefrontRow) {
    const card = storefrontRow.querySelector<HTMLElement>(".features__card--light");
    const cardVisual = card?.querySelector<HTMLElement>(".features__card-visual");
    const title = card?.querySelector<HTMLElement>(".features__card-title");
    const desc = card?.querySelector<HTMLElement>(".features__card-desc");
    const btn = card?.querySelector<HTMLElement>(".features__card-cta .btn");
    const avatar = storefrontRow.querySelector<HTMLElement>(".features__circle-avatar");

    // Entrance Timeline: Card and avatar slide in towards center, contents animate
    const sfTl = gsap.timeline({
      scrollTrigger: {
        trigger: storefrontRow,
        start: "top 65%",
        once: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "power3.out" },
    });

    // Light Card fades in from left (direction toRight) using fade-3 preset
    if (card) {
      sfTl.from(card, getFadeVars("toRight", "fade-3"), 0);
    }

    // Circle avatar fades in from right (direction toLeft) using fade-3 preset
    if (avatar) {
      sfTl.from(avatar, getFadeVars("toLeft", "fade-3"), 0);
    }

    // Card visual mockup fades in from left (direction toRight)
    if (cardVisual) {
      sfTl.from(cardVisual, getFadeVars("toRight", "fade-1"), "<.3");
    }

    if (title) {
      sfTl.add(() => {
        headerWordAnimation(title, 0.025, 0.45);
      }, "<");
    }

    if (desc) {
      sfTl.add(() => {
        bodyLineAnimation(desc, 0.06, 0.5);
      }, "<.2");
    }

    if (btn) {
      sfTl.from(btn, getFadeVars("toTop", "fade-btn"), "<.25");
    }

    // Subtle Avatar Parallax Scrub
    const avatarImgElement = avatar?.querySelector<HTMLElement>("img");
    if (avatarImgElement) {
      gsap.fromTo(
        avatarImgElement,
        {
          yPercent: -6,
          scale: 1.08,
          transformOrigin: "50% 50%",
        },
        {
          yPercent: 6,
          scale: 1.08,
          transformOrigin: "50% 50%",
          ease: "none",
          scrollTrigger: {
            trigger: storefrontRow,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.2,
            invalidateOnRefresh: true,
          },
        },
      );
    }
  }

  // 2. Dashboard Row (.features__row--dashboard)
  const dashboardRow = features.querySelector<HTMLElement>(".features__row--dashboard");
  if (dashboardRow) {
    const card = dashboardRow.querySelector<HTMLElement>(".features__card--dark");
    const cardVisual = card?.querySelector<HTMLElement>(".features__card-visual");
    const title = card?.querySelector<HTMLElement>(".features__card-title");
    const desc = card?.querySelector<HTMLElement>(".features__card-desc");
    const btn = card?.querySelector<HTMLElement>(".features__card-cta .btn");
    const avatar = dashboardRow.querySelector<HTMLElement>(".features__circle-avatar");

    // Entrance Timeline: Card and avatar slide in towards center, contents animate
    const dbTl = gsap.timeline({
      scrollTrigger: {
        trigger: dashboardRow,
        start: "top 80%",
        once: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "power3.out" },
    });

    // Circle avatar fades in from left (direction toRight) using fade-3 preset
    if (avatar) {
      dbTl.from(avatar, getFadeVars("toRight", "fade-3"), 0);
    }

    // Dark Card fades in from right (direction toLeft) using fade-3 preset
    if (card) {
      dbTl.from(card, getFadeVars("toLeft", "fade-3"), 0);
    }

    // Card visual mockup fades in from right using fade-3 preset
    if (cardVisual) {
      dbTl.from(cardVisual, getFadeVars("toLeft", "fade-1"), "<.3");
    }

    if (title) {
      dbTl.add(() => {
        headerWordAnimation(title, 0.025, 0.45);
      }, "<");
    }

    if (desc) {
      dbTl.add(() => {
        bodyLineAnimation(desc, 0.06, 0.5);
      }, "<.2");
    }

    if (btn) {
      dbTl.from(btn, getFadeVars("toTop", "fade-btn"), "<.25");
    }

    // Subtle Avatar Parallax Scrub
    const avatarImgElement = avatar?.querySelector<HTMLElement>("img");
    if (avatarImgElement) {
      gsap.fromTo(
        avatarImgElement,
        {
          yPercent: -6,
          scale: 1.08,
          transformOrigin: "50% 50%",
        },
        {
          yPercent: 6,
          scale: 1.08,
          transformOrigin: "50% 50%",
          ease: "none",
          scrollTrigger: {
            trigger: dashboardRow,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.2,
            invalidateOnRefresh: true,
          },
        },
      );
    }
  }

  // 3. Section 3 Callout Statement (.features__callout)
  const callout = features.querySelector<HTMLElement>(".features__callout");
  if (callout) {
    const leftIcon = callout.querySelector<HTMLElement>(".features__callout-icon--left");
    const rightIcon = callout.querySelector<HTMLElement>(".features__callout-icon--right");
    const text = callout.querySelector<HTMLElement>(".features__callout-text");
    const highlight = callout.querySelector<HTMLElement>(".features__callout-highlight");

    const icons = [leftIcon, rightIcon].filter(Boolean) as HTMLElement[];

    // Entrance Timeline
    const calloutTl = gsap.timeline({
      scrollTrigger: {
        trigger: callout,
        start: "top 75%",
        once: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "power3.out" },
    });

    // Fade in the 2 illustration assets with scale animation from fade-scale preset
    if (icons.length) {
      calloutTl.from(
        icons,
        {
          ...getFadeVars("toTop", "fade-scale"),
          stagger: 0.12,
        },
        0,
      );
    }

    // Animate text with body text animation
    if (text) {
      calloutTl.add(() => {
        gsap.set(text, { autoAlpha: 1 });
        const textTl = bodyLineAnimation(text, 0.03, 0.6);
        if (textTl && highlight) {
          textTl.eventCallback("onComplete", () => {
            gsap.fromTo(
              highlight,
              { backgroundColor: "rgba(233, 243, 251, 0)" },
              {
                backgroundColor: "rgba(233, 243, 251, 1)",
                duration: 0.45,
                ease: "power2.out",
              },
            );
          });
        }
      }, 0.1);
    }

    // Scrub Animation: left icon animates up, right icon animates down
    if (leftIcon || rightIcon) {
      const scrubTl = gsap.timeline({
        scrollTrigger: {
          trigger: callout,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
        defaults: { ease: "none" },
      });

      if (leftIcon) {
        scrubTl.fromTo(leftIcon, { y: 25 }, { y: -25 }, 0);
      }
      if (rightIcon) {
        scrubTl.fromTo(rightIcon, { y: -25 }, { y: 25 }, 0);
      }
    }
  }
}

export function initStorefrontSection(): void {
  const storefront = document.querySelector<HTMLElement>(".storefront-feat");
  if (!storefront) return;

  const visual = storefront.querySelector<HTMLElement>(".storefront-feat__visual");
  const mockupImg = storefront.querySelector<HTMLElement>(".storefront-feat__mockup-img");
  const title = storefront.querySelector<HTMLElement>(".storefront-feat__title");
  const listContainer = storefront.querySelector<HTMLElement>(".storefront-feat__list-container");
  const items = storefront.querySelectorAll<HTMLElement>("[data-storefront-item]");

  // Instantly hide items and reset glass list container styles before entrance
  if (items.length) {
    gsap.set(items, {
      autoAlpha: 0,
      y: () => responsiveClamp(18, 28),
    });
  }

  if (listContainer) {
    gsap.set(listContainer, {
      backgroundColor: "rgba(255, 255, 255, 0)",
      borderColor: "rgba(255, 255, 255, 0)",
      boxShadow: "0 4px 44px rgba(255, 255, 255, 0)",
    });
  }

  // 1. Entrance Timeline: starts after user scrolls down into the section (top 45%)
  const entranceTl = gsap.timeline({
    scrollTrigger: {
      trigger: storefront,
      start: "top 45%",
      once: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: "power3.out" },
  });

  // A. Tablet mockup slides and floats in from right/bottom
  if (visual) {
    entranceTl.from(
      visual,
      {
        autoAlpha: 0,
        x: () => responsiveClamp(40, 80),
        y: () => responsiveClamp(30, 60),
        scale: 0.94,
        duration: 0.95,
        ease: "power3.out",
        clearProps: "transform",
      },
      0,
    );
  }

  // B. Section Title word animation
  if (title) {
    entranceTl.add(() => {
      headerWordAnimation(title, 0.025, 0.45);
    }, 0.1);
  }

  // C. Stagger every storefront-feat__item with fade toTop (starts first)
  if (items.length) {
    entranceTl.to(
      items,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.out",
        clearProps: "transform",
      },
      0.1,
    );
  }

  // D. Glass List Container background & stroke/shadow fade in (~0.2s delay after items start)
  if (listContainer) {
    entranceTl.to(
      listContainer,
      {
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        borderColor: "rgba(255, 255, 255, 0.5)",
        boxShadow: "0 4px 44px rgba(255, 255, 255, 0.42)",
        duration: 0.75,
        ease: "power2.out",
        clearProps: "backgroundColor,borderColor,boxShadow",
      },
      0.3,
    );
  }

  // 2. Parallax scrub on the Tablet Mockup as user scrolls through the section
  if (mockupImg || visual) {
    const targetParallax = mockupImg || visual;
    gsap.fromTo(
      targetParallax,
      {
        yPercent: -6,
      },
      {
        yPercent: 6,
        ease: "none",
        scrollTrigger: {
          trigger: storefront,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      },
    );
  }

  // 3. Interactive click, keyboard navigation & seamless auto-rotation with GSAP
  const DURATION = 5; // 5 seconds per item
  let currentIndex = Array.from(items).findIndex((item) =>
    item.classList.contains("storefront-feat__item--active"),
  );
  if (currentIndex === -1) currentIndex = 0;

  let currentProgressTween: gsap.core.Tween | null = null;
  let isSectionInView = false;

  const activateItem = (index: number, autoStart = true) => {
    if (index < 0 || index >= items.length) return;
    currentIndex = index;

    // Clean up current tween
    if (currentProgressTween) {
      currentProgressTween.kill();
      currentProgressTween = null;
    }

    items.forEach((item, i) => {
      const isActive = i === index;
      item.classList.toggle("storefront-feat__item--active", isActive);
      item.setAttribute("aria-expanded", isActive ? "true" : "false");

      const progress = item.querySelector<HTMLElement>(".storefront-feat__badge-progress");
      if (progress) {
        gsap.set(progress, { height: "0%" });
      }
    });

    const activeItem = items[currentIndex];
    const activeProgress = activeItem?.querySelector<HTMLElement>(
      ".storefront-feat__badge-progress",
    );

    if (activeProgress && autoStart && isSectionInView) {
      currentProgressTween = gsap.fromTo(
        activeProgress,
        { height: "0%" },
        {
          height: "100%",
          duration: DURATION,
          ease: "none",
          onComplete: () => {
            const nextIndex = (currentIndex + 1) % items.length;
            activateItem(nextIndex, true);
          },
        },
      );
    }
  };

  const startAutoPlay = () => {
    if (!isSectionInView) return;
    if (currentProgressTween) {
      currentProgressTween.resume();
    } else {
      activateItem(currentIndex, true);
    }
  };

  const pauseAutoPlay = () => {
    currentProgressTween?.pause();
  };

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      activateItem(index, true);
    });

    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateItem(index, true);
      }
    });
  });

  // ScrollTrigger viewport observer for auto-play
  ScrollTrigger.create({
    trigger: storefront,
    start: "top 65%",
    end: "bottom 20%",
    onToggle: (self) => {
      isSectionInView = self.isActive;
      if (self.isActive) {
        startAutoPlay();
      } else {
        pauseAutoPlay();
      }
    },
  });

  // Check if already in viewport on init
  if (ScrollTrigger.isInViewport(storefront, 0.2)) {
    isSectionInView = true;
    startAutoPlay();
  }
}

export function initShopSection(): void {
  const section = document.querySelector<HTMLElement>(".shop-feat");
  if (!section) return;

  const visual = section.querySelector<HTMLElement>(".shop-feat__visual");
  const mockupImg = section.querySelector<HTMLElement>(".shop-feat__mockup-img");
  const title = section.querySelector<HTMLElement>(".shop-feat__title");
  const accordion = section.querySelector<HTMLElement>(".shop-feat__accordion");
  const items = section.querySelectorAll<HTMLElement>("[data-accordion-item]");

  // Instantly hide items before entrance
  if (items.length) {
    gsap.set(items, {
      autoAlpha: 0,
      y: () => responsiveClamp(18, 28),
    });
  }

  // 1. Entrance Timeline: starts after user scrolls down into the section (top 45%)
  const entranceTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top 45%",
      once: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: "power3.out" },
  });

  // A. Visual mockup fades in / slides in
  if (visual) {
    entranceTl.from(
      visual,
      {
        autoAlpha: 0,
        x: () => responsiveClamp(40, 80),
        y: () => responsiveClamp(20, 40),
        scale: 0.94,
        duration: 0.95,
        ease: "power3.out",
        clearProps: "transform",
      },
      0,
    );
  }

  // B. Section Title word animation
  if (title) {
    entranceTl.add(() => {
      headerWordAnimation(title, 0.025, 0.45);
    }, 0.1);
  }

  // C. Stagger every accordion item directly with smooth fade toTop
  if (items.length) {
    entranceTl.to(
      items,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.85,
        stagger: 0.09,
        ease: "power3.out",
        clearProps: "transform",
      },
      0.18,
    );
  }

  // 2. Parallax scrub on the Visual Mockup as user scrolls through the section
  if (mockupImg || visual) {
    const targetParallax = mockupImg || visual;
    gsap.fromTo(
      targetParallax,
      {
        yPercent: -5,
      },
      {
        yPercent: 5,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      },
    );
  }

  // 3. Accordion interactive click & keyboard navigation with auto-rotation
  let currentIndex = Array.from(items).findIndex((item) =>
    item.classList.contains("shop-feat__item--active"),
  );
  if (currentIndex === -1) currentIndex = 0;

  let autoPlayTimer: ReturnType<typeof setInterval> | null = null;
  let isHovered = false;
  let isSectionInView = false;
  const AUTO_PLAY_INTERVAL = 4500; // 4.5 seconds

  const activateAccordionItem = (index: number) => {
    if (index < 0 || index >= items.length) return;
    currentIndex = index;

    items.forEach((item, i) => {
      const isActive = i === index;
      item.classList.toggle("shop-feat__item--active", isActive);
      item.setAttribute("aria-expanded", isActive ? "true" : "false");
    });
  };

  const nextAccordionItem = () => {
    const nextIdx = (currentIndex + 1) % items.length;
    activateAccordionItem(nextIdx);
  };

  const startAutoPlay = () => {
    if (autoPlayTimer) clearInterval(autoPlayTimer);
    if (isHovered || !isSectionInView) return;
    autoPlayTimer = setInterval(nextAccordionItem, AUTO_PLAY_INTERVAL);
  };

  const stopAutoPlay = () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  };

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      activateAccordionItem(index);
      stopAutoPlay();
      startAutoPlay();
    });

    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateAccordionItem(index);
        stopAutoPlay();
        startAutoPlay();
      }
    });
  });

  // Pause on hover, resume on mouse leave
  if (accordion) {
    accordion.addEventListener("mouseenter", () => {
      isHovered = true;
      stopAutoPlay();
    });

    accordion.addEventListener("mouseleave", () => {
      isHovered = false;
      startAutoPlay();
    });
  }

  // Viewport-aware autoplay trigger
  ScrollTrigger.create({
    trigger: section,
    start: "top 80%",
    end: "bottom 20%",
    onEnter: () => {
      isSectionInView = true;
      startAutoPlay();
    },
    onLeave: () => {
      isSectionInView = false;
      stopAutoPlay();
    },
    onEnterBack: () => {
      isSectionInView = true;
      startAutoPlay();
    },
    onLeaveBack: () => {
      isSectionInView = false;
      stopAutoPlay();
    },
  });
}

export function initStepsSection(): void {
  const section = document.querySelector<HTMLElement>(".steps");
  if (!section) return;

  const card = section.querySelector<HTMLElement>(".steps__card");
  const title = section.querySelector<HTMLElement>(".steps__title");
  const desc = section.querySelector<HTMLElement>(".steps__header-desc");
  const btn = section.querySelector<HTMLElement>(".steps__header-right .btn");
  const timelineLine = section.querySelector<HTMLElement>(".steps__timeline-line");
  const timelineEl = section.querySelector<HTMLElement>(".steps__timeline");
  const progressLine = section.querySelector<HTMLElement>(".steps__timeline-progress");
  const items = section.querySelectorAll<HTMLElement>(".steps__item");

  // 1. Entrance Timeline: Header & Card reveal
  const entranceTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top 45%",
      once: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: "power3.out" },
  });

  if (card) {
    entranceTl.from(card, getFadeVars("toTop", "fade-2"), 0);
  }

  if (title) {
    entranceTl.add(() => {
      headerWordAnimation(title, 0.025, 0.45);
    }, 0.1);
  }

  if (desc) {
    entranceTl.add(() => {
      bodyLineAnimation(desc, 0.06, 0.5);
    }, 0.2);
  }

  if (btn) {
    entranceTl.from(btn, getFadeVars("toTop", "fade-btn"), 0.35);
  }

  // 2. Continuous Scroll Scrub for Step Wizard & Progress Line
  if (timelineEl && progressLine && items.length) {
    // Dynamically calculate bounds so the timeline starts at Step 1 dot and ends right at Step 4 dot
    const updateTimelineBounds = () => {
      if (!timelineLine || !items.length) return;
      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        const firstDot = items[0].querySelector<HTMLElement>(".steps__dot");
        const lastDot = items[items.length - 1].querySelector<HTMLElement>(".steps__dot");
        if (firstDot && lastDot) {
          const timelineRect = timelineEl.getBoundingClientRect();
          const firstDotRect = firstDot.getBoundingClientRect();
          const lastDotRect = lastDot.getBoundingClientRect();

          const top = firstDotRect.top + firstDotRect.height / 2 - timelineRect.top;
          const bottom = timelineRect.bottom - (lastDotRect.top + lastDotRect.height / 2);
          const left = firstDotRect.left + firstDotRect.width / 2 - timelineRect.left;

          timelineLine.style.top = `${top}px`;
          timelineLine.style.bottom = `${bottom}px`;
          timelineLine.style.left = `${left}px`;
          timelineLine.style.transform = "translateX(-50%)";
        }
      } else {
        timelineLine.style.top = "";
        timelineLine.style.bottom = "";
        timelineLine.style.left = "";
        timelineLine.style.transform = "";
      }
    };

    updateTimelineBounds();
    window.addEventListener("resize", updateTimelineBounds);
    ScrollTrigger.addEventListener("refresh", updateTimelineBounds);

    // Initial state
    gsap.set(progressLine, { height: "0%" });

    const stepCount = items.length;
    const updateStepsState = (progress: number) => {
      const clampedProgress = Math.min(Math.max(progress, 0), 1);
      // Direct scrub height calculation
      gsap.set(progressLine, { height: `${clampedProgress * 100}%` });

      let activeIdx = 0;
      for (let i = stepCount - 1; i >= 0; i--) {
        const threshold = i === 0 ? 0 : i / (stepCount - 1) - 0.02;
        if (clampedProgress >= threshold) {
          activeIdx = i;
          break;
        }
      }

      items.forEach((item, i) => {
        const isActive = i === activeIdx;
        const isPassed = i < activeIdx;
        item.classList.toggle("steps__item--active", isActive);
        item.classList.toggle("steps__item--passed", isPassed);
        item.setAttribute("aria-expanded", isActive ? "true" : "false");
      });
    };

    ScrollTrigger.create({
      trigger: timelineLine || timelineEl,
      start: "top 65%",
      end: "bottom 65%",
      scrub: 0.3,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        updateStepsState(self.progress);
      },
    });

    // Item click navigation
    items.forEach((item, index) => {
      item.addEventListener("click", () => {
        items.forEach((it, i) => {
          const isActive = i === index;
          const isPassed = i < index;
          it.classList.toggle("steps__item--active", isActive);
          it.classList.toggle("steps__item--passed", isPassed);
          it.setAttribute("aria-expanded", isActive ? "true" : "false");
        });
      });
    });
  }
}

export function initTemplatesSection(): void {
  const section = document.querySelector<HTMLElement>(".templates");
  if (!section) return;

  const title = section.querySelector<HTMLElement>(".templates__title");
  const subtitle = section.querySelector<HTMLElement>(".templates__subtitle");
  const swiperEl = section.querySelector<HTMLElement>(".templates__swiper");
  const prevBtn = section.querySelector<HTMLElement>(".templates__nav-btn--prev");
  const nextBtn = section.querySelector<HTMLElement>(".templates__nav-btn--next");
  const paginationEl = section.querySelector<HTMLElement>(".templates__pagination");

  // 1. Swiper Carousel Instance
  if (swiperEl) {
    new Swiper(swiperEl, {
      modules: [Navigation, Pagination, Keyboard, A11y],
      slidesPerView: 1.15,
      spaceBetween: 10,
      loop: false,
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      navigation: {
        prevEl: prevBtn,
        nextEl: nextBtn,
      },
      pagination: {
        el: paginationEl,
        clickable: true,
        bulletClass: "templates__bullet",
        bulletActiveClass: "templates__bullet--active",
      },
      breakpoints: {
        640: {
          slidesPerView: 2.15,
          spaceBetween: 12,
        },
        1120: {
          slidesPerView: 3.15,
          spaceBetween: 14,
        },
      },
    });
  }

  // 2. Text Entrance Timeline
  const entranceTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top 70%",
      once: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: "power3.out" },
  });

  if (title) {
    entranceTl.add(() => {
      headerWordAnimation(title, 0.025, 0.45);
    }, 0);
  }

  if (subtitle) {
    entranceTl.add(() => {
      bodyLineAnimation(subtitle, 0.06, 0.5);
    }, 0.12);
  }

  const carouselGroup =
    section.querySelector<HTMLElement>(".templates__carousel-group") || swiperEl;

  if (carouselGroup) {
    entranceTl.from(carouselGroup, getFadeVars("toTop", "fade-2"), 0.25);
  }

  // 3. Background Image Parallax Scrub (similar to feature avatar circles)
  const bg = section.querySelector<HTMLElement>(".templates__bg");
  if (bg) {
    gsap.fromTo(
      bg,
      {
        yPercent: -6,
        scale: 1.08,
        transformOrigin: "50% 50%",
      },
      {
        yPercent: 6,
        scale: 1.08,
        transformOrigin: "50% 50%",
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      },
    );
  }
}

export function initPricingSection(): void {
  const section = document.querySelector<HTMLElement>(".pricing");
  if (!section) return;

  const header = section.querySelector<HTMLElement>(".pricing__header");
  const title = section.querySelector<HTMLElement>(".pricing__title");
  const desc = section.querySelector<HTMLElement>(".pricing__header-desc");
  const ctaBtn = section.querySelector<HTMLElement>(".pricing__header-right .btn");
  const toggle = section.querySelector<HTMLElement>(
    ".pricing__cycle-toggle, [data-pricing-toggle-wrapper]",
  );
  const cards = section.querySelectorAll<HTMLElement>(".pricing-card");

  // 1. Header Entrance Timeline
  const headerTl = gsap.timeline({
    scrollTrigger: {
      trigger: header || section,
      start: "top 70%",
      once: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: "power3.out" },
  });

  // A. Header Title Word Split Reveal
  if (title) {
    headerTl.add(() => {
      headerWordAnimation(title, 0.025, 0.45);
    }, 0);
  }

  // B. Header Description Line Reveal
  if (desc) {
    headerTl.add(() => {
      bodyLineAnimation(desc, 0.06, 0.5);
    }, 0.12);
  }

  // C. Header Register Button
  if (ctaBtn) {
    headerTl.from(ctaBtn, getFadeVars("toTop", "fade-btn"), 0.25);
  }

  // D. Billing Cycle Toggle fade toBottom
  if (toggle) {
    headerTl.from(toggle, getFadeVars("toBottom", "fade-1"), 0.2);
  }

  // 2. Pricing Cards Grid Staggered Entrance
  if (cards.length) {
    const grid = section.querySelector<HTMLElement>(".pricing__grid");

    // Instantly prepare cards for entrance
    gsap.set(cards, {
      autoAlpha: 0,
      y: () => responsiveClamp(24, 38),
    });

    const cardsTl = gsap.timeline({
      scrollTrigger: {
        trigger: grid || cards[0],
        start: "top 75%",
        once: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "power3.out" },
    });

    cardsTl.to(
      cards,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        clearProps: "transform",
      },
      0,
    );
  }
}

export function initCtaSection(): void {
  const section = document.querySelector<HTMLElement>(".cta-section");
  if (!section) return;

  const card = section.querySelector<HTMLElement>(".cta-section__card");
  const badge = section.querySelector<HTMLElement>(".cta-section__badge");
  const avatars = section.querySelectorAll<HTMLElement>(".cta-section__avatar");
  const heading = section.querySelector<HTMLElement>(".cta-section__heading");
  const fields = section.querySelectorAll<HTMLElement>(".cta-section__field");
  const submitBtn = section.querySelector<HTMLElement>(".cta-section__submit");
  const visual = section.querySelector<HTMLElement>(".cta-section__visual");
  const mockupImg = visual?.querySelector<HTMLElement>("img");

  const formElements = [...Array.from(fields), submitBtn].filter(Boolean) as HTMLElement[];

  // Pre-hide inner children so they never flash/snap during card entrance
  if (badge) {
    gsap.set(badge, { autoAlpha: 0, y: 16, scale: 0.92 });
  }
  if (avatars.length) {
    gsap.set(avatars, { autoAlpha: 0, scale: 0.5 });
  }
  if (formElements.length) {
    gsap.set(formElements, { autoAlpha: 0, y: 18 });
  }

  // Entrance Timeline
  const entranceTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top 70%",
      once: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: "power3.out" },
  });

  // 1. Left Gradient Card slides in from left (direction toRight) using fade-3
  if (card) {
    entranceTl.from(card, getFadeVars("toRight", "fade-3"), 0);
  }

  // 2. Right Visual Mockup slides in from right (direction toLeft) using fade-3 (exact match to features circle avatar)
  if (visual) {
    entranceTl.from(visual, getFadeVars("toLeft", "fade-3"), 0);
  }

  // 3. Customer badge reveal
  if (badge) {
    entranceTl.to(
      badge,
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        ease: "power2.out",
        clearProps: "transform",
      },
      0.18,
    );
  }

  // 4. Stagger avatars inside badge
  if (avatars.length) {
    entranceTl.to(
      avatars,
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.45,
        stagger: 0.08,
        ease: "back.out(1.5)",
        clearProps: "transform",
      },
      0.28,
    );
  }

  // 5. Heading word animation (slower, more pronounced entrance)
  if (heading) {
    const headingTl = headerWordAnimation(heading, 0.08, 0.75);
    if (headingTl) {
      entranceTl.add(headingTl, 0.22);
    }
  }

  // 6. Form fields & Submit button stagger smoothly with to()
  if (formElements.length) {
    entranceTl.to(
      formElements,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.09,
        ease: "power2.out",
        clearProps: "transform",
      },
      0.45,
    );
  }

  // 7. Subtle Avatar Parallax Scrub on circular mockup image (exact match to features circle avatar)
  if (mockupImg) {
    gsap.fromTo(
      mockupImg,
      {
        yPercent: -6,
        scale: 1.08,
        transformOrigin: "50% 50%",
      },
      {
        yPercent: 6,
        scale: 1.08,
        transformOrigin: "50% 50%",
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      },
    );
  }
}

export function initFooterSection(): void {
  const footer = document.querySelector<HTMLElement>(".footer");
  if (!footer) return;

  const contacts = footer.querySelector<HTMLElement>(".footer__contacts");
  const contactCards = footer.querySelectorAll<HTMLElement>(".footer__contact-card");
  const contactIconBoxes = footer.querySelectorAll<HTMLElement>(".footer__contact-icon-box");
  const contactTextSpans = footer.querySelectorAll<HTMLElement>(".footer__contact-text span");

  const footerCard = footer.querySelector<HTMLElement>(".footer__card");
  const logo = footer.querySelector<HTMLElement>(".footer__logo");
  const tagline = footer.querySelector<HTMLElement>(".footer__tagline");
  const colHeadings = footer.querySelectorAll<HTMLElement>(".footer__col-heading");
  const links = footer.querySelectorAll<HTMLElement>(".footer__link");
  const legalLinks = footer.querySelectorAll<HTMLElement>(".footer__legal-link");
  const copyright = footer.querySelector<HTMLElement>(".footer__copyright");
  const bottomElements = [...Array.from(legalLinks), copyright].filter(Boolean) as HTMLElement[];

  // Pre-hide inner children so they don't flash/snap during card entrance
  if (contactIconBoxes.length) {
    gsap.set(contactIconBoxes, { autoAlpha: 0, scale: 0.4, rotation: -20 });
  }
  if (contactTextSpans.length) {
    gsap.set(contactTextSpans, { autoAlpha: 0, y: 10 });
  }

  if (logo) {
    gsap.set(logo, { autoAlpha: 0, scale: 0.8, y: 16 });
  }
  if (tagline) {
    gsap.set(tagline, { autoAlpha: 0, y: 14 });
  }
  if (colHeadings.length) {
    gsap.set(colHeadings, { autoAlpha: 0, y: 14 });
  }
  if (links.length) {
    gsap.set(links, { autoAlpha: 0, y: 14 });
  }
  if (bottomElements.length) {
    gsap.set(bottomElements, { autoAlpha: 0, y: 10 });
  }

  // 1. Upper Contact Cards Timeline: triggers when contacts enter viewport
  if (contacts && contactCards.length) {
    const contactTl = gsap.timeline({
      scrollTrigger: {
        trigger: contacts,
        start: "top 85%",
        once: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "power3.out" },
    });

    // Contact Cards spring entrance
    contactTl.from(
      contactCards,
      {
        autoAlpha: 0,
        y: () => responsiveClamp(25, 45),
        scale: 0.9,
        duration: 0.75,
        stagger: 0.12,
        ease: "back.out(1.4)",
        clearProps: "transform",
      },
      0,
    );

    // Contact Icons 3D rotation & scale pop
    if (contactIconBoxes.length) {
      contactTl.to(
        contactIconBoxes,
        {
          autoAlpha: 1,
          scale: 1,
          rotation: 0,
          duration: 0.65,
          stagger: 0.12,
          ease: "back.out(2.2)",
          clearProps: "transform",
        },
        0.15,
      );
    }

    // Contact text lines stagger
    if (contactTextSpans.length) {
      contactTl.to(
        contactTextSpans,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: "power2.out",
          clearProps: "transform",
        },
        0.2,
      );
    }
  }

  // 2. Main Footer Card Timeline: triggers when the white card reaches 86% of viewport
  if (footerCard) {
    const cardTl = gsap.timeline({
      scrollTrigger: {
        trigger: footerCard,
        start: "top 86%",
        once: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: "power3.out" },
    });

    // Main Card expansive entrance
    cardTl.from(
      footerCard,
      {
        autoAlpha: 0,
        scale: 0.93,
        y: () => responsiveClamp(24, 48),
        duration: 0.85,
        ease: "power3.out",
        clearProps: "transform",
      },
      0,
    );

    // Brand Logo pop & scale
    if (logo) {
      cardTl.to(
        logo,
        {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          duration: 0.6,
          ease: "back.out(1.6)",
          clearProps: "transform",
        },
        0.18,
      );
    }

    // Tagline reveal
    if (tagline) {
      cardTl.to(
        tagline,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          ease: "power2.out",
          clearProps: "transform",
        },
        0.25,
      );
    }

    // Column Headings reveal
    if (colHeadings.length) {
      cardTl.to(
        colHeadings,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          clearProps: "transform",
        },
        0.25,
      );
    }

    // Navigation and Social Links cascading stagger
    if (links.length) {
      cardTl.to(
        links,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.035,
          ease: "power2.out",
          clearProps: "transform",
        },
        0.35,
      );
    }

    // Bottom Legal Links & Copyright reveal
    if (bottomElements.length) {
      cardTl.to(
        bottomElements,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.06,
          ease: "power2.out",
          clearProps: "transform",
        },
        0.45,
      );
    }
  }
}
