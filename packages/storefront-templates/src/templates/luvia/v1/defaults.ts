import type { LuviaV1Data, LuviaV1ThemeTokens } from "./schema";

export const luviaV1Defaults: LuviaV1Data = {
  header: {
    useShopName: false,
    navigation: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/products" },
      { label: "Contact", href: "/contact" },
    ],
  },
  home: {
    hero: {
      enabled: true,
      title: "Wake Up to Softer, Brighter, and More Radiant Skin",
      subtitle:
        "Essentials that nourish your skin's barrier, promoting a radiant, dewy glow that looks stunning and feels refreshing and healthy all day.",
      primaryCtaLabel: "Shop Our Essentials",
      primaryCtaHref: "/products",
      trustLabels: ["Clean & Natural", "Barrier Focused", "Clinically Inspired"],
      featuredProductIds: [],
    },
    featuredProducts: {
      enabled: true,
      title: "Our Top-Picks",
      productIds: [],
      limit: 8,
    },
    products: {
      enabled: true,
      title: "Products Listing",
      productIds: [],
      limit: 12,
    },
    categories: {
      enabled: true,
      title: "Shop by category",
      categoryIds: [],
    },
    cta: {
      enabled: true,
      title: "Explore Pure Science for Radiant Skin Today",
      primary: { enabled: true, label: "Shop Now", href: "/products" },
      secondary: { enabled: true, label: "Contact Us", href: "/contact" },
    },
  },
  footer: {
    blurb: "A collection of leading beauty products for thoughtful, effective skincare routines.",
    credit: {
      enabled: true,
    },
    // Left undefined on purpose. applyShopDetails overwrites these from
    // Settings > Shop at read time, so a literal here means any legacy tenant
    // without valid shopDetails publishes these contact details instead of
    // none. Demo copy belongs in luvia-fixture.ts.
    phone: undefined,
    email: undefined,
    address: undefined,
    socialLinks: [
      { label: "Facebook", href: "https://facebook.com" },
      { label: "Instagram", href: "https://instagram.com" },
      { label: "Twitter", href: "https://x.com" },
      { label: "Pinterest", href: "https://pinterest.com" },
    ],
    quickLinks: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/products" },
      { label: "Contact", href: "/contact" },
      { label: "Wishlist", href: "/wishlist" },
    ],
    shopLinks: [
      { label: "All products", href: "/products" },
      { label: "Wishlist", href: "/wishlist" },
    ],
    inquiry: {
      title: "Do you have any inquiries for us?",
      ctaLabel: "Let’s Get in Touch",
      ctaHref: "/contact",
    },
  },
};

export const luviaV1ThemeTokens: LuviaV1ThemeTokens = {
  autoPalette: true,
  colorMode: "light",
  colors: {
    background: "#f7fff7",
    foreground: "#0f3112",
    primary: "#3ee272",
    muted: "#edf8ee",
    accent: "#b5ffa2",
  },
  typography: {
    headingFont: "GC Molecule Demo",
    bodyFont: "GC Molecule Demo",
  },
  radius: "md",
};
