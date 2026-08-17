import { z } from "zod";

const navigationItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const linkItemSchema = navigationItemSchema.extend({
  enabled: z.boolean().default(true),
});

const merchandisingSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().min(1),
  productIds: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(48).default(8),
});

export const luviaV1DataSchema = z.object({
  header: z.object({
    logoAssetId: z.string().min(1).optional(),
    navigation: z.array(navigationItemSchema),
  }),
  home: z.object({
    hero: z.object({
      enabled: z.boolean().default(true),
      eyebrow: z.string().optional(),
      title: z.string().min(1),
      subtitle: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
      portraitAssetId: z.string().min(1).optional(),
      featuredProductId: z.string().min(1).optional(),
      primaryCtaLabel: z.string().min(1),
      primaryCtaHref: z.string().min(1),
      trustLabels: z.array(z.string().min(1)).length(3),
    }),
    featuredProducts: merchandisingSchema,
    featuredCollection: z.object({
      enabled: z.boolean().default(true),
      title: z.string().default(""),
      collectionId: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(48).default(12),
    }),
    story: z.object({
      enabled: z.boolean().default(true),
      body: z.string().min(1),
      titleFirstLine: z.string().min(1),
      titleSecondLine: z.string().min(1),
      ctaLabel: z.string().min(1).default("All Collections"),
      ctaHref: z.string().min(1).default("/products"),
    }),
    products: merchandisingSchema,
    brandStatement: z.object({
      enabled: z.boolean().default(true),
      firstLine: z.string().min(1),
      middleLine: z.string().min(1),
      lastLine: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
    }),
    expertise: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      body: z.string().min(1),
      quote: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
      ctaLabel: z.string().min(1).default("About Luvia"),
      ctaHref: z.string().min(1).default("/about"),
    }),
    categories: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      collectionIds: z.array(z.string()).default([]),
      imageAssetId: z.string().min(1).optional(),
      previewAssetId: z.string().min(1).optional(),
    }),
    cta: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
      primary: linkItemSchema,
      secondary: linkItemSchema,
    }),
  }),
  footer: z.object({
    blurb: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    socialLinks: z.array(navigationItemSchema),
    quickLinks: z.array(navigationItemSchema).default([
      { label: "Home", href: "/" }, { label: "About", href: "/about" },
      { label: "Shop", href: "/products" }, { label: "Contact", href: "/contact" },
      { label: "Wishlist", href: "/wishlist" },
    ]),
    shopLinks: z.array(navigationItemSchema).default([
      { label: "All products", href: "/products" },
      { label: "Request an item", href: "/request-item" },
      { label: "Wishlist", href: "/wishlist" },
    ]),
    inquiry: z.object({
      title: z.string().min(1),
      ctaLabel: z.string().min(1),
      ctaHref: z.string().min(1),
    }).default({ title: "Do you have any inquiries for us?", ctaLabel: "Let’s Get in Touch", ctaHref: "/contact" }),
  }),
});

export type LuviaV1Data = z.infer<typeof luviaV1DataSchema>;

export const luviaV1ThemeTokensSchema = z.object({
  autoPalette: z.boolean().default(true),
  colors: z.object({
    background: z.string().min(1),
    foreground: z.string().min(1),
    primary: z.string().min(1),
    muted: z.string().min(1),
    accent: z.string().min(1),
  }),
  typography: z.object({
    headingFont: z.string().min(1),
    bodyFont: z.string().min(1),
  }),
  radius: z.enum(["none", "sm", "md"]),
  colorMode: z.literal("light"),
});

export type LuviaV1ThemeTokens = z.infer<typeof luviaV1ThemeTokensSchema>;
