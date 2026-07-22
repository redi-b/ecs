import { z } from "zod";

const trustItemSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

const testimonialItemSchema = z.object({
  quote: z.string().min(1),
  author: z.string().min(1),
});

export const classicV1DataSchema = z.object({
  announcement: z
    .object({
      enabled: z.boolean().default(true),
      text: z.string().min(1),
    })
    .optional(),
  header: z.object({
    logoAssetId: z.string().min(1).optional(),
    navigation: z.array(
      z.object({
        label: z.string().min(1),
        href: z.string().min(1),
      }),
    ),
  }),
  home: z.object({
    hero: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      subtitle: z.string().optional(),
      imageAssetId: z.string().min(1).optional(),
      primaryCtaLabel: z.string().min(1),
      primaryCtaHref: z.string().min(1),
      secondaryCtaLabel: z.string().optional(),
      secondaryCtaHref: z.string().optional(),
    }),
    /** Merchant-selected collection rail (e.g. "Our Top Picks"). */
    featuredCollection: z
      .object({
        enabled: z.boolean().default(false),
        title: z.string().min(1),
        collectionId: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(48).default(8),
      })
      .optional(),
    featuredProducts: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      /** Manual product IDs; empty = newest catalog slice when enabled. */
      productIds: z.array(z.string()),
      limit: z.number().int().min(1).max(48).default(8),
    }),
    collectionsStrip: z
      .object({
        title: z.string().min(1),
        enabled: z.boolean().default(true),
      })
      .optional(),
    trust: z
      .object({
        enabled: z.boolean().default(true),
        items: z.array(trustItemSchema).default([]),
      })
      .optional(),
    testimonials: z
      .object({
        enabled: z.boolean().default(false),
        title: z.string().min(1).default("What customers say"),
        items: z.array(testimonialItemSchema).default([]),
      })
      .optional(),
  }),
  footer: z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
    blurb: z.string().optional(),
    socialLinks: z.array(
      z.object({
        label: z.string().min(1),
        href: z.string().min(1),
      }),
    ),
  }),
});

export type ClassicV1Data = z.infer<typeof classicV1DataSchema>;

export const classicThemeTokensSchema = z.object({
  colors: z.object({
    background: z.string().min(1),
    foreground: z.string().min(1),
    primary: z.string().min(1),
    muted: z.string().min(1),
    accent: z.string().min(1).optional(),
  }),
  typography: z.object({
    headingFont: z.string().min(1),
    bodyFont: z.string().min(1),
  }),
  radius: z.enum(["none", "sm", "md"]),
});

/** @deprecated Prefer classicThemeTokensSchema — kept for existing imports */
export const themeTokensSchema = classicThemeTokensSchema;

export type ThemeTokens = z.infer<typeof classicThemeTokensSchema>;
export type ClassicThemeTokens = ThemeTokens;
