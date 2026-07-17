import type { ClassicV1Data, ThemeTokens } from "./schema";

export const classicV1Defaults: ClassicV1Data = {
  announcement: {
    enabled: true,
    text: "Now accepting orders online.",
  },
  header: {
    navigation: [
      { label: "Shop", href: "/products" },
      { label: "Contact", href: "#contact" },
    ],
  },
  home: {
    hero: {
      title: "Your shop, online",
      subtitle: "Browse products and place an order in minutes.",
      primaryCtaLabel: "Shop products",
      primaryCtaHref: "/products",
    },
    featuredProducts: {
      title: "Featured products",
      productIds: [],
    },
  },
  footer: {
    socialLinks: [],
  },
};

export const classicV1ThemeTokens: ThemeTokens = {
  colors: {
    background: "#ffffff",
    foreground: "#111827",
    primary: "#0f766e",
    muted: "#f3f4f6",
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Inter",
  },
  radius: "sm",
};
