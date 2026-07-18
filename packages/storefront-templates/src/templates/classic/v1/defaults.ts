import type { ClassicV1Data, ThemeTokens } from "./schema";

export const classicV1Defaults: ClassicV1Data = {
  announcement: {
    enabled: true,
    text: "Free local pickup · Cash on delivery available",
  },
  header: {
    navigation: [
      { label: "Shop", href: "/products" },
      { label: "Contact", href: "#contact" },
    ],
  },
  home: {
    hero: {
      title: "Crafted for everyday commerce",
      subtitle: "Browse the catalog, add to cart, and checkout in a few taps — delivery or pickup.",
      primaryCtaLabel: "Browse the shop",
      primaryCtaHref: "/products",
    },
    featuredProducts: {
      title: "Featured picks",
      productIds: [],
    },
  },
  footer: {
    socialLinks: [],
  },
};

export const classicV1ThemeTokens: ThemeTokens = {
  colors: {
    background: "#f6f1ea",
    foreground: "#1c1917",
    primary: "#0f4c3a",
    muted: "#ebe4d8",
  },
  typography: {
    headingFont: "Fraunces",
    bodyFont: "DM Sans",
  },
  radius: "md",
};
