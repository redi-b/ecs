import type { ClassicThemeTokens, ClassicV1Data } from "./schema";

export const classicV1Defaults: ClassicV1Data = {
  announcement: {
    enabled: true,
    text: "Order online from our shop in Addis",
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
      enabled: true,
      title: "Find something you love",
      subtitle: "Browse new arrivals, pick your options, and check out in a few steps.",
      primaryCtaLabel: "Shop now",
      primaryCtaHref: "/products",
      secondaryCtaLabel: "View cart",
      secondaryCtaHref: "/cart",
    },
    featuredCollection: {
      enabled: false,
      title: "",
      limit: 8,
    },
    featuredProducts: {
      enabled: true,
      title: "Featured",
      productIds: [],
      limit: 8,
    },
    collectionsStrip: {
      title: "Collections",
      enabled: true,
    },
    trust: {
      enabled: true,
      items: [
        {
          title: "Easy checkout",
          body: "Order online in a few steps on this shop.",
        },
        {
          title: "Clear options",
          body: "Choose size, color, and more before you buy.",
        },
        {
          title: "Shop details",
          body: "Fulfillment and payment choices appear at checkout.",
        },
      ],
    },
    testimonials: {
      enabled: false,
      title: "What customers say",
      items: [],
    },
  },
  footer: {
    blurb: "Fulfillment and payment options are shown at checkout.",
    socialLinks: [],
  },
};

/** Cold forest luxury: bone on deep green-black, sage primary, clay accent. */
export const classicV1ThemeTokens: ClassicThemeTokens = {
  surfaceMode: "dark",
  autoPalette: true,
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
