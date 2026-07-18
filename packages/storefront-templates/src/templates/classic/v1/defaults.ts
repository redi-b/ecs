import type { ClassicThemeTokens, ClassicV1Data } from "./schema";

export const classicV1Defaults: ClassicV1Data = {
  announcement: {
    enabled: true,
    text: "Local delivery and pickup across Addis",
  },
  header: {
    navigation: [
      { label: "Shop", href: "/products" },
      { label: "Collections", href: "/products" },
      { label: "Contact", href: "#contact" },
    ],
  },
  home: {
    hero: {
      title: "Find something you love",
      subtitle: "Browse new arrivals, pick your options, and check out with delivery or pickup.",
      primaryCtaLabel: "Shop now",
      primaryCtaHref: "/products",
      secondaryCtaLabel: "View cart",
      secondaryCtaHref: "/cart",
    },
    featuredProducts: {
      title: "Featured",
      productIds: [],
    },
    collectionsStrip: {
      title: "Collections",
      enabled: true,
    },
  },
  footer: {
    blurb: "Delivery, pickup, and cash on delivery when available.",
    socialLinks: [],
  },
};

/** Cold forest luxury: bone on deep green-black, sage primary, clay accent. */
export const classicV1ThemeTokens: ClassicThemeTokens = {
  colors: {
    background: "#0b0f0d",
    foreground: "#e6ebe4",
    primary: "#9bc4a0",
    muted: "#141a16",
    accent: "#d4785a",
  },
  typography: {
    headingFont: "Syne",
    bodyFont: "Outfit",
  },
  radius: "sm",
};
