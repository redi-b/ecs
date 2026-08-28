import type { StoreProduct } from "./commerce/types.js";
import type { StorefrontSeo } from "./seo.js";

type JsonLd = Record<string, unknown>;

export function buildProductStructuredData(input: {
  product: StoreProduct | null;
  seo: StorefrontSeo;
}): JsonLd | null {
  const { product, seo } = input;
  if (!product?.title?.trim() || seo.noindex) return null;

  const selectedVariant =
    product.variants.find((variant) => variant.inStock) ?? product.variants[0] ?? null;
  const amount = selectedVariant?.priceAmount ?? product.priceAmount;
  const currency = (selectedVariant?.currencyCode ?? product.currencyCode)?.trim().toUpperCase();
  const hasOffer =
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    Boolean(currency && /^[A-Z]{3}$/.test(currency));

  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title.trim(),
    description: product.description?.trim() || undefined,
    image: seo.imageUrl ? [seo.imageUrl] : undefined,
    sku: selectedVariant?.sku?.trim() || undefined,
    offers: hasOffer
      ? {
          "@type": "Offer",
          availability: selectedVariant?.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          price: amount,
          priceCurrency: currency,
          url: seo.canonicalUrl,
        }
      : undefined,
  });
}

export function buildStorefrontStructuredData(input: {
  seo: StorefrontSeo;
  tenantName: string;
}): JsonLd[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: input.tenantName,
      url: input.seo.canonicalUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: input.tenantName,
      url: input.seo.canonicalUrl,
    },
  ];
}

export function serializeJsonLd(value: JsonLd | JsonLd[]) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function compact(value: JsonLd): JsonLd {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
