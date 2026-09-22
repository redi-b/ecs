import { shopDetailsSchema } from "@ecs/contracts";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

const socialLabels = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", telegram: "Telegram", whatsapp: "WhatsApp", youtube: "YouTube", linkedin: "LinkedIn", x: "X" };

/** Public contacts are owned by Settings → Shop, not by a published design revision. */
export function applyShopDetails(data: unknown, details: unknown): unknown {
  const parsed = shopDetailsSchema.safeParse(details);
  const source = record(data);
  if (!parsed.success || !source) return data;
  const shop = parsed.data;
  return {
    ...source,
    footer: {
      ...record(source.footer),
      managedContact: true,
      phone: shop.primaryPhone,
      additionalPhones: shop.additionalPhones,
      email: shop.publicEmail || undefined,
      address: [shop.address?.streetAddress, shop.address?.city, shop.address?.directions].filter(Boolean).join(" · ") || undefined,
      socialLinks: shop.socialProfiles.map((profile) => ({ label: socialLabels[profile.platform], href: profile.url })),
      blurb: shop.description || "Explore our products.",
    },
  };
}

/** Only for a newly provisioned shop: demo artwork and example copy stay in demos. */
export function createBrandedShopData(data: unknown, name: string, details: unknown): unknown {
  const source = record(applyShopDetails(data, details));
  if (!source) return data;
  const home = record(source.home);
  const hero = record(home?.hero);
  const footer = record(source.footer);
  const parsed = shopDetailsSchema.safeParse(details);
  const contacts = parsed.success ? footer : { ...footer, phone: undefined, email: undefined, address: undefined, socialLinks: [] };
  return {
    ...source,
    header: { ...record(source.header), logoAssetId: undefined, useShopName: true },
    footer: { ...contacts, blurb: parsed.data?.description || `Explore ${name}.` },
    ...(record(source.listing) ? { listing: { ...record(source.listing), body: "Browse our available products." } } : {}),
    ...(home && hero ? { home: {
      ...home,
      hero: { ...hero, title: name, eyebrow: "Welcome to our shop", primaryCtaLabel: "Shop products", primaryCtaHref: "/products", trustLabels: [], ...(typeof hero.body === "string" ? { body: parsed.data?.description || "Explore our products and find something for you." } : {}), ...(typeof hero.subtitle === "string" ? { subtitle: parsed.data?.description || "Explore our products and find something for you." } : {}) },
      ...(record(home.quality) ? { quality: { ...record(home.quality), enabled: false, eyebrow: `About ${name}`, title: `Welcome to ${name}`, body: parsed.data?.description || "Explore our products and contact our shop for help.", accordion1Title: "Product information", accordion1Body: "Check each product for its specifications and available options.", accordion2Title: "Returns and warranty", accordion2Body: "Contact the shop for the terms that apply to your product before ordering." } } : {}),
      ...(record(home.featuredItem) ? { featuredItem: { ...record(home.featuredItem), title: "Featured products", body: "A closer look at products from our shop." } } : {}),
      ...(record(home.categories) ? { categories: { ...record(home.categories), title: "Browse our collections" } } : {}),
      ...(record(home.bestSellers) ? { bestSellers: { ...record(home.bestSellers), title: "Our products" } } : {}),
      ...(record(home.contact) ? { contact: { ...record(home.contact), body: `Contact ${name} for product questions and help with your order.` } } : {}),
      ...(record(home.cta) ? { cta: { ...record(home.cta), title: "Find your next purchase" } } : {}),
    } } : {}),
  };
}
