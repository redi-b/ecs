import type { LuviaV1Data, LuviaV1ThemeTokens } from "./schema";

export const luviaV1Defaults: LuviaV1Data = {
  header: {
    navigation: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/products" },
      { label: "Request Item", href: "/request-item" },
      { label: "About Us", href: "/about" },
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
    },
    featuredProducts: {
      enabled: true,
      title: "Our Top-Picks",
      productIds: [],
      limit: 8,
    },
    featuredCollection: {
      enabled: false,
      title: "",
      collectionId: undefined,
      limit: 12,
    },
    story: {
      enabled: true,
      body: "Pure ingredients sourced for your natural radiance. Explore our curated collection, and start your glowing journey!",
      titleFirstLine: "ADVANCED",
      titleSecondLine: "SELF-CARE",
      ctaLabel: "All Collections",
      ctaHref: "/products",
    },
    products: {
      enabled: true,
      title: "Products Listing",
      productIds: [],
      limit: 12,
    },
    brandStatement: {
      enabled: true,
      firstLine: "COMPLETE",
      middleLine: "COSMETIC",
      lastLine: "ESSENTIALS",
      imageAssetId: undefined,
    },
    expertise: {
      enabled: true,
      title: "The Expertise Behind Luvia's Products",
      body: "We are a research-driven lab creating beauty through pure innovation. Every product is a refined result of our shared clinical journey.",
      quote:
        "Designed for those who seek purity in their beauty routine. We combine ancient botanical wisdom with modern clinical science to deliver unparalleled results for your skin's health.",
      ctaLabel: "About Luvia",
      ctaHref: "/about",
    },
    categories: {
      enabled: true,
      title: "Find Your Perfect Match in Cosmetic Products.",
      collectionIds: [],
    },
    cta: {
      enabled: true,
      title: "Explore Pure Science for Radiant Skin Today",
      primary: { enabled: true, label: "Shop Now", href: "/products" },
      secondary: { enabled: true, label: "Contact Us", href: "/contact" },
    },
  },
  footer: {
    blurb:
      "A collection of leading beauty products for thoughtful, effective skincare routines.",
    phone: "+251 91 266 5485",
    email: "hello@luviabeauty.com",
    address: "Kassanchis, Addis Ababa, Ethiopia",
    socialLinks: [
      { label: "Facebook", href: "https://facebook.com" },
      { label: "Instagram", href: "https://instagram.com" },
      { label: "Twitter", href: "https://x.com" },
      { label: "Pinterest", href: "https://pinterest.com" },
    ],
    quickLinks: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Shop", href: "/products" },
      { label: "Contact", href: "/contact" },
      { label: "Wishlist", href: "/wishlist" },
    ],
    shopLinks: [
      { label: "All products", href: "/products" },
      { label: "Request an item", href: "/request-item" },
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
    accent: "#d3ffd7",
  },
  typography: {
    headingFont: "GC Molecule Demo",
    bodyFont: "Right Grotesk",
  },
  radius: "md",
};
