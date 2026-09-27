import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initHeader(): void {
  const header = document.querySelector<HTMLElement>(".header");
  if (!header) return;

  const toggle = header.querySelector<HTMLButtonElement>(".header__toggle");
  const menu = header.querySelector<HTMLElement>(".header__menu");
  const backdrop = header.querySelector<HTMLElement>(".header__backdrop");
  const menuItems = header.querySelectorAll<HTMLElement>(".header__menu-item");
  const menuLinks = header.querySelectorAll<HTMLAnchorElement>(
    ".header__menu-link, .header__menu-cta",
  );

  let isMenuOpen = false;
  let menuAnimation: gsap.core.Timeline | null = null;

  const openMenu = () => {
    if (isMenuOpen || !menu) return;
    isMenuOpen = true;
    header.classList.add("is-open");
    toggle?.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");

    menuAnimation?.kill();
    menuAnimation = gsap.timeline();

    // 1. Immediately slide marquee up under the navbar
    if (marquee) {
      gsap.to(marquee, {
        y: -34,
        autoAlpha: 0,
        duration: 0.35,
        ease: "power2.inOut",
        overwrite: "auto",
        onComplete: () => {
          marquee.style.pointerEvents = "none";
        },
      });
    }

    // 2. Open menu with bouncy spring expansion
    gsap.set(menu, {
      display: "block",
      autoAlpha: 0,
      scaleY: 0.75,
      y: -12,
      transformOrigin: "top center",
    });

    menuAnimation
      .to(menu, {
        autoAlpha: 1,
        scaleY: 1,
        y: 0,
        duration: 0.48,
        ease: "back.out(1.5)",
      })
      .fromTo(
        menuItems,
        { y: 16, autoAlpha: 0, scale: 0.96 },
        {
          y: 0,
          autoAlpha: 1,
          scale: 1,
          duration: 0.38,
          stagger: 0.045,
          ease: "power3.out",
        },
        "-=0.35",
      );
  };

  const closeMenu = () => {
    if (!isMenuOpen || !menu) return;
    isMenuOpen = false;
    header.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");

    menuAnimation?.kill();
    menuAnimation = gsap.timeline({
      onComplete: () => {
        gsap.set(menu, { display: "none" });

        // Bring marquee back out from under navbar ONLY after menu is completely closed
        if (marquee && window.scrollY <= 15) {
          gsap.to(marquee, {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            ease: "back.out(1.3)",
            overwrite: "auto",
            onComplete: () => {
              marquee.style.pointerEvents = "auto";
            },
          });
        }
      },
    });

    menuAnimation
      .to(menuItems, {
        y: 12,
        autoAlpha: 0,
        scale: 0.96,
        duration: 0.35,
        stagger: { each: 0.035, from: "end" },
        ease: "power3.inOut",
      })
      .to(
        menu,
        {
          autoAlpha: 0,
          scaleY: 0.75,
          y: -12,
          duration: 0.48,
          ease: "back.in(1.5)",
        },
        "-=0.3",
      );
  };

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      if (isMenuOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close on backdrop click
    backdrop?.addEventListener("click", closeMenu);
    document.addEventListener("pointerdown", (event) => {
      if (
        isMenuOpen &&
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        closeMenu();
      }
    });

    // Close on nav link click
    menuLinks.forEach((link) => {
      link.addEventListener("click", () => {
        closeMenu();
      });
    });

    // Close on Escape key
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMenuOpen) {
        closeMenu();
      }
    });
  }

  const marquee = header.querySelector<HTMLElement>(".header__marquee");
  if (marquee) {
    let isHidden = false;

    // If loaded while already scrolled down, initialize in hidden state
    if (window.scrollY > 30) {
      isHidden = true;
      gsap.set(marquee, { y: -34 });
      marquee.style.pointerEvents = "none";
      header.classList.add("is-marquee-hidden");
    }

    const hideMarquee = () => {
      if (isHidden) return;
      isHidden = true;
      header.classList.add("is-marquee-hidden");
      gsap.to(marquee, {
        y: -34,
        duration: 0.38,
        ease: "power2.inOut",
        overwrite: "auto",
        onComplete: () => {
          marquee.style.pointerEvents = "none";
        },
      });
    };

    const showMarquee = () => {
      if (!isHidden) return;
      isHidden = false;
      marquee.style.pointerEvents = "auto";
      header.classList.remove("is-marquee-hidden");
      gsap.to(marquee, {
        y: 0,
        duration: 0.45,
        ease: "back.out(1.3)",
        overwrite: "auto",
      });
    };

    let lastScrollY = window.scrollY;

    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const currentScroll = self.scroll();
        const diff = currentScroll - lastScrollY;

        // When user is near the very top (within top 15px), always keep marquee revealed
        if (currentScroll <= 15) {
          showMarquee();
          lastScrollY = currentScroll;
          return;
        }

        // Only react if scroll delta is meaningful (> 2px) to avoid micro-jitter
        if (Math.abs(diff) >= 2) {
          if (diff > 0 || self.direction === 1) {
            // Scrolling DOWN -> hide marquee to where it came from
            hideMarquee();
          } else if (diff < 0 || self.direction === -1) {
            // Scrolling UP -> reveal marquee
            showMarquee();
          }
          lastScrollY = currentScroll;
        }
      },
    });
  }
}
