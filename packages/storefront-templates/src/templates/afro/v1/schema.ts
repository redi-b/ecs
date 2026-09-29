import { z } from "zod";

const navigationItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const selectableProductsSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().min(1),
  productIds: z.array(z.string().min(1)).max(24).default([]),
  limit: z.number().int().min(1).max(24).default(12),
});

export const afroV1DataSchema = z.object({
  header: z.object({
    useShopName: z.boolean().optional(),
    logoAssetId: z.string().min(1).optional(),
    promoText: z.string().optional(),
    countdownText: z.string().optional(),
    navigation: z.array(navigationItemSchema),
  }),
  home: z.object({
    hero: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      imageAssetId: z.string().min(1).optional(),
      productIds: z.array(z.string().min(1)).max(6).default([]),
    }),
    categories: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      categoryIds: z.array(z.string().min(1)).max(12).default([]),
      /** @deprecated Kept so previously saved drafts continue to parse. */
      collectionIds: z.array(z.string().min(1)).max(12).optional(),
    }),
    products: selectableProductsSchema,
    collections: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      collectionIds: z.array(z.string().min(1)).max(8).default([]),
    }),
    contact: z.object({
      enabled: z.boolean().default(true),
      title: z.string().min(1),
      infoTitle: z.string().min(1),
      infoBody: z.string().min(1),
    }),
  }),
  listing: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    imageAssetId: z.string().min(1).optional(),
  }),
  footer: z.object({
    managedContact: z.boolean().optional(),
    additionalPhones: z.array(z.string()).optional(),
    blurb: z.string().min(1),
    phone: z.string().optional(),
    phone2: z.string().optional(),
    email: z.string().optional(),
    // applyShopDetails injects this for every template; without the key zod
    // stripped it and afro alone never showed the merchant's shop address.
    address: z.string().optional(),
    quickLinks: z.array(navigationItemSchema).optional().default([]),
    socialLinks: z.array(navigationItemSchema),
    credit: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  }),
});

export type AfroV1Data = z.infer<typeof afroV1DataSchema>;

// These land in inline `--afro-*` custom properties that the stylesheet then
// feeds to alpha(). Restricting them to 6-digit hex keeps those
// combinations valid in every engine.
const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Expected a hex colour such as #1c120d");

export const afroV1ThemeTokensSchema = z.object({
  autoPalette: z.boolean().default(true),
  colors: z.object({
    background: hexColor,
    foreground: hexColor,
    primary: hexColor,
    muted: hexColor,
    accent: hexColor,
  }),
  typography: z.object({
    headingFont: z.literal("Roobert TRIAL").or(z.string().min(1)),
    bodyFont: z.literal("Helvetica Now Display").or(z.string().min(1)),
  }),
  radius: z.literal("smooth").or(z.string().min(1)),
  colorMode: z.literal("light"),
});

export type AfroV1ThemeTokens = z.infer<typeof afroV1ThemeTokensSchema>;
