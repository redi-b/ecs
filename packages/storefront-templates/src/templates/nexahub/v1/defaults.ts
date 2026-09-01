import type { NexahubV1Data, NexahubV1ThemeTokens } from "./schema";

export const nexahubV1Defaults: NexahubV1Data = {
  header: {
    navigation: [
      { label: "Home", href: "/" },
      { label: "Products", href: "/products" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  home: {
    hero: {
      enabled: true,
      eyebrow: "All-in-One Tech Store",
      title: "BIG DEALS ON TOP TECH PRODUCTS",
      body: "EXPLORE DURABLE TECH DEVICES DESIGNED TO FIT YOUR ROUTINE. FIND THE IDEAL GADGETS THAT BOOST YOUR DAILY LIFE AND ENHANCE YOUR PRODUCTIVITY.",
      primaryCtaLabel: "Our Products",
      primaryCtaHref: "#products",
    },
    featuredItem: {
      enabled: true,
      eyebrow: "FEATURED PRODUCTS",
      title: "Lenovo Ideapad Gaming 3",
      body: "A focused look at one of the latest products available from this store.",
      productIds: [],
    },
    categories: {
      enabled: true,
      eyebrow: "PRODUCTS CATALOGUE",
      title: "Elite Hardware for High-Performance Workflows",
      collectionIds: [],
    },
    bestSellers: {
      enabled: true,
      title: "Browse Our Full Tech Products Collection",
      productIds: [],
      limit: 8,
    },
    quality: {
      enabled: true,
      eyebrow: "ABOUT NEXAHUB",
      title: "QUALITY TECHNOLOGY, SELECTED WITH CARE.",
      body: "CONNECTING GLOBAL INNOVATION WITH LOCAL EXCELLENCE, THIS PLATFORM OFFERS CUTTING-EDGE TECH SOLUTIONS AND STRONG SUPPORT TO EMPOWER THE ETHIOPIAN MARKET.",
      accordion1Title: "PREMIUM QUALITY PRODUCTS",
      accordion1Body:
        "EXPLORE DURABLE TECHNOLOGY SELECTED TO SUPPORT WORK, PLAY, AND EVERYDAY LIFE.",
      accordion2Title: "WARRANTY SUPPORT",
      accordion2Body:
        "SEE THE WARRANTY COVERAGE AVAILABLE FOR YOUR CHOSEN PRODUCTS AND GET HELP WHEN YOU NEED IT.",
      accordion3Title: "CONVENIENT DELIVERY",
      accordion3Body:
        "CHOOSE FROM THE DELIVERY AND PICKUP OPTIONS AVAILABLE FOR YOUR ORDER AT CHECKOUT.",
      accordion4Title: "CUSTOMER SUPPORT",
      accordion4Body:
        "CONTACT THE SHOP FOR HELP WITH PRODUCT QUESTIONS, ORDERS, AND AFTER-SALES SUPPORT.",
    },
    contact: {
      enabled: true,
      eyebrow: "Contact Us",
      title: "Any Questions? Let's Get in Touch!",
      body: "Send a message to the NexaHub team.",
      ctaLabel: "Send Message",
      ctaHref: "/contact",
    },
  },
  listing: {
    eyebrow: "Our catalog",
    title: "Products",
    body: "Browse available technology and accessories from our current catalog.",
  },
  footer: {
    blurb: "Technology selected for work, creativity, and everyday life.",
    phone: "+251 91 842 7255",
    email: "info@nexahub.com",
    address: "4th floor 1234 Innovation Avenue, Bole, Addis Ababa, Ethiopia",
    quickLinks: [
      { label: "Home", href: "/" },
      { label: "Products", href: "/products" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
    socialLinks: [
      { label: "Instagram", href: "https://instagram.com" },
      { label: "Facebook", href: "https://facebook.com" },
      { label: "LinkedIn", href: "https://linkedin.com" },
    ],
    credit: { enabled: true },
  },
};

export const nexahubV1ThemeTokens: NexahubV1ThemeTokens = {
  autoPalette: true,
  colorMode: "light",
  colors: {
    background: "#f8f8fc",
    foreground: "#262732",
    primary: "#3064d5",
    muted: "#f0f0f6",
    accent: "#b4cffd",
  },
  typography: {
    headingFont: "Space Grotesk",
    bodyFont: "DM Mono",
  },
  radius: "none",
};
