import { z } from "zod";

const navigationItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const selectableProductsSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().min(1),
  productIds: z.array(z.string().min(1)).max(24).default([]),
  limit: z.number().int().min(1).max(24).default(8),
});

export const nexahubV1DataSchema = z.object({
  header: z.object({
    logoAssetId: z.string().min(1).optional(),
    navigation: z.array(navigationItemSchema),
  }),
  home: z.object({
    hero: z.object({
      enabled: z.boolean().default(true),
      eyebrow: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
      primaryCtaLabel: z.string().min(1),
      primaryCtaHref: z.string().min(1),
    }),
    featuredItem: z.object({
      enabled: z.boolean().default(true),
      eyebrow: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      productId: z.string().min(1).optional(),
      productIds: z.array(z.string().min(1)).max(5).default([]),
      imageAssetId: z.string().min(1).optional(),
    }),
    categories: z.object({
      enabled: z.boolean().default(true),
      eyebrow: z.string().min(1),
      title: z.string().min(1),
      collectionIds: z.array(z.string().min(1)).max(6).default([]),
    }),
    bestSellers: selectableProductsSchema,
    quality: z.object({
      enabled: z.boolean().default(true),
      eyebrow: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
    }),
    contact: z.object({
      enabled: z.boolean().default(true),
      eyebrow: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
      ctaLabel: z.string().min(1),
      ctaHref: z.string().min(1),
    }),
  }),
  listing: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  footer: z.object({
    blurb: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    quickLinks: z.array(navigationItemSchema),
    socialLinks: z.array(navigationItemSchema),
    credit: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  }),
});

export type NexahubV1Data = z.infer<typeof nexahubV1DataSchema>;

export const nexahubV1ThemeTokensSchema = z.object({
  autoPalette: z.literal(true).default(true),
  colors: z.object({
    background: z.string().min(1),
    foreground: z.string().min(1),
    primary: z.string().min(1),
    muted: z.string().min(1),
    accent: z.string().min(1),
  }),
  typography: z.object({
    headingFont: z.literal("Space Grotesk"),
    bodyFont: z.literal("DM Mono"),
  }),
  radius: z.literal("none"),
  colorMode: z.literal("light"),
});

export type NexahubV1ThemeTokens = z.infer<typeof nexahubV1ThemeTokensSchema>;
