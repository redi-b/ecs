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
      title: "Shop built for how you sell",
      subtitle: "Browse the catalog, add to cart, and checkout with delivery or pickup.",
      primaryCtaLabel: "Browse the shop",
      primaryCtaHref: "/products",
      secondaryCtaLabel: "View cart",
      secondaryCtaHref: "/cart",
    },
    featuredProducts: {
      title: "In stock now",
      productIds: [],
    },
    collectionsStrip: {
      title: "Collections",
      enabled: true,
    },
  },
  footer: {
    blurb: "Cash on delivery, local pickup, and product options that stay clear.",
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
