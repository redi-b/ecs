import type { AfroV1Data, AfroV1ThemeTokens } from "./schema";

export const afroV1Defaults: AfroV1Data = {
  header: {
    promoText: "SUMMER SALE · 20% OFF DISCOUNT · ENDS IN",
    countdownText: "12:00:42",
    navigation: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/products" },
      { label: "Categories", href: "/#categories" },
      { label: "Collections", href: "/#collections" },
    ],
  },
  home: {
    hero: {
      enabled: true,
      title: "Style That Feels Good Today and Lasts for Seasons.",
      productIds: [],
    },
    categories: {
      enabled: true,
      title: "Find your own style with confidence.",
      collectionIds: [],
    },
    products: {
      enabled: true,
      title: "Your go-to clothing for every day.",
      productIds: [],
      limit: 12,
    },
    collections: {
      enabled: true,
      title: "Everything you need to dress well, feel well, and look well.",
      collectionIds: [],
    },
    contact: {
      enabled: true,
      title: "Have a question or looking for something specific?",
      infoTitle: "Let’s keep in touch!",
      infoBody: "Reach out anytime or follow us online to see what we’re up to.",
    },
  },
  listing: {
    title: "All Collections",
    body: "Explore our collection of thoughtful modern apparel designed for everyday rhythm and timeless ease.",
  },
  footer: {
    blurb:
      "Style that feels good today and lasts for seasons. Thoughtfully crafted essentials for your everyday rhythm.",
    quickLinks: [],
    socialLinks: [],
    credit: { enabled: true },
  },
};

export const afroV1ThemeTokens: AfroV1ThemeTokens = {
  autoPalette: true,
  colorMode: "light",
  colors: {
    background: "#fffbf8",
    foreground: "#1c120d",
    primary: "#ff720a",
    muted: "#f8f2ed",
    accent: "#ffc599",
  },
  typography: {
    headingFont: "Roobert TRIAL",
    bodyFont: "Helvetica Now Display",
  },
  radius: "smooth",
};
