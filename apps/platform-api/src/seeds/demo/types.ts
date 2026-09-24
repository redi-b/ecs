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
};

export type DemoProductOption = {
  title: string;
  values: readonly string[];
};

export type DemoProductVariant = {
  /** Option title → value, e.g. { Size: "M", Color: "Black" }. */
  options: Record<string, string>;
  price: number;
  sku: string;
  /** Absolute stocked quantity; omit for a healthy default. */
  stock?: number;
  title?: string;
};

export type DemoProduct = {
  /** Category handle for assignment (prefer leaf categories). */
  categoryHandle?: string;
  collectionHandle?: string;
  description: string;
  handle: string;
  /** Broad merchandising family retained in seeded product metadata. */
  imageCategory: string;
  options: readonly DemoProductOption[];
  title: string;
  variants: readonly DemoProductVariant[];
};

export type DemoProductImage = {
  /** Stable Pexels photo page retained for license/source auditing. */
  sourceUrl: string;
  /** CDN rendition copied into ECS media storage by the demo seed. */
  url: string;
};

export type DemoShopDefinition = {
  categories: ReadonlyArray<DemoCategory>;
  collections: ReadonlyArray<{ handle: string; title: string }>;
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
