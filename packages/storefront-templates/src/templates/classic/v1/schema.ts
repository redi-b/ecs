import { z } from "zod";

export const classicV1DataSchema = z.object({
  announcement: z
    .object({
      enabled: z.boolean(),
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
      title: z.string().min(1),
      subtitle: z.string().optional(),
      imageAssetId: z.string().min(1).optional(),
      primaryCtaLabel: z.string().min(1),
      primaryCtaHref: z.string().min(1),
    }),
    featuredProducts: z.object({
      title: z.string().min(1),
      productIds: z.array(z.string()),
    }),
  }),
  footer: z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
    socialLinks: z.array(
      z.object({
        label: z.string().min(1),
        href: z.string().min(1),
      }),
    ),
  }),
});

export type ClassicV1Data = z.infer<typeof classicV1DataSchema>;

export const themeTokensSchema = z.object({
  colors: z.object({
    background: z.string().min(1),
    foreground: z.string().min(1),
    primary: z.string().min(1),
    muted: z.string().min(1),
  }),
  typography: z.object({
    headingFont: z.string().min(1),
    bodyFont: z.string().min(1),
  }),
  radius: z.enum(["none", "sm", "md"]),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
