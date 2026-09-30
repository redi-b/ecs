import type { MerchantDocumentBranding, ShopDetails } from "@ecs/contracts";

const presetColors: Record<NonNullable<ShopDetails["brand"]>["presetId"], string> = {
  amber: "#b45309",
  blue: "#2563eb",
  original: "#18181b",
  rose: "#be123c",
  teal: "#0f766e",
  violet: "#7c3aed",
};

export function snapshotMerchantDocumentBranding(
  details: ShopDetails | null | undefined,
): MerchantDocumentBranding {
  const settings = details?.documentBranding;
  const address = details?.address;
  const showContactDetails = settings?.showContactDetails ?? true;

  return {
    accentColor:
      settings?.accentColor ||
      details?.brand?.customPrimary ||
      presetColors[details?.brand?.presetId ?? "original"],
    address:
      showContactDetails && address
        ? [address.streetAddress, address.city, address.directions].filter(Boolean).join(" · ") ||
          null
        : null,
    email: showContactDetails && details?.publicEmail ? details.publicEmail : null,
    footerNote: settings?.footerNote || null,
    logoUrl: settings?.logoUrl || null,
    phone: showContactDetails && details?.primaryPhone ? details.primaryPhone : null,
  };
}
