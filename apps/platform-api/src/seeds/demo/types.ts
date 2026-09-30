/**
 * Demo seed definitions: two Ethiopian shops (tech + fashion), separate owners.
 * Stable IDs keep re-seeds idempotent.
 *
 * Handles:
 *   - addistech  (tech; no dashes — easy to type)
 *   - bolestyle   (fashion)
 */

export type DemoCustomer = {
  address: string;
  area: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type DemoCategory = {
  handle: string;
  name: string;
  /** Parent category handle within the same shop (nested taxonomy). */
  parentHandle?: string;
  /** Cover image asset filename or public URL. */
  mediaUrl?: string | undefined;
};

export type DemoCollection = {
  handle: string;
  title: string;
  /** Cover image asset filename or public URL. */
  mediaUrl?: string | undefined;
};

export type DemoProductOption = {
  title: string;
  values: readonly string[];
};

export type DemoProductVariant = {
  /** Option title → value, e.g. { Size: "M", Color: "Black" }. */
  options: Record<string, string>;
  price: number;
  /** Strikethrough price for discounted/sale items. */
  originalPrice?: number | undefined;
  sku: string;
  /** Absolute stocked quantity; omit for a healthy default. 0 = sold out. */
  stock?: number | undefined;
  title?: string | undefined;
};

export type DemoProduct = {
  /** Category handle for assignment (prefer leaf categories). */
  categoryHandle?: string | undefined;
  collectionHandle?: string | undefined;
  description: string;
  handle: string;
  /** Broad merchandising family retained in seeded product metadata. */
  imageCategory: string;
  options: readonly DemoProductOption[];
  title: string;
  variants: readonly DemoProductVariant[];
  /** Strikethrough original price if the entire product is discounted. */
  originalPrice?: number | undefined;
  /** Color swatches or presentation overrides for options. */
  optionPresentation?: Record<string, Record<string, { kind: "color"; value: string }>> | undefined;
  /** Image URLs / filenames mapped to option values (e.g. Color -> [image1, image2]). */
  optionMediaBindings?: { optionTitle: string; mappings: Record<string, string[]> } | undefined;
};

export type DemoProductImage = {
  /** Stable Pexels photo page retained for license/source auditing. */
  sourceUrl: string;
  /** CDN rendition copied into ECS media storage by the demo seed. */
  url: string;
};

export type DemoShopSocialProfile = {
  platform: "facebook" | "instagram" | "tiktok" | "telegram" | "whatsapp" | "youtube" | "linkedin" | "x";
  url: string;
};

export type DemoShopDetails = {
  version: 1;
  categories: string[];
  description: string;
  primaryPhone: string;
  additionalPhones: string[];
  publicEmail: string;
  address?: {
    city: string;
    streetAddress: string;
    directions: string;
  };
  socialProfiles: DemoShopSocialProfile[];
};

export type DemoShopDefinition = {
  categories: ReadonlyArray<DemoCategory>;
  collections: ReadonlyArray<DemoCollection>;
  customers: ReadonlyArray<DemoCustomer>;
  ids: {
    account: string;
    domain: string;
    membership: string;
    onboarding: string;
    storefrontConfig: string;
    storefrontRevision: string;
    tenant: string;
    user: string;
  };
  /** Payment onboarding stub for Settings UI (no real Chapa secrets). */
  paymentOnboarding: {
    notes: string;
    status: string;
  };
  products: ReadonlyArray<DemoProduct>;
  /** Shop contact info, socials, and description — injected into storefront footer via applyShopDetails. */
  shopDetails: DemoShopDetails;
  templateKey?: string;
  tenant: {
    handle: string;
    name: string;
  };
  user: {
    email: string;
    name: string;
    phone: string;
  };
};
