import { shopDetailsSchema } from "@ecs/contracts";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const socialLabels = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

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
      address:
        [shop.address?.streetAddress, shop.address?.city, shop.address?.directions]
          .filter(Boolean)
          .join(" · ") || undefined,
      socialLinks: shop.socialProfiles.map((profile) => ({
        label: socialLabels[profile.platform],
        href: profile.url,
      })),
      blurb: shop.description || record(source.footer)?.blurb,
    },
  };
}

/** Only for a newly provisioned shop: example copy stays in demos; the header keeps the template's default logo. */
export function createBrandedShopData(data: unknown, _name: string, details: unknown): unknown {
  return applyShopDetails(data, details);
}
