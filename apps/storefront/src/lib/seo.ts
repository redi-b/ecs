export type StorefrontSeo = {
  canonicalUrl: string;
  description: string;
  imageUrl?: string;
  noindex?: boolean;
  title: string;
};

export function buildStorefrontSeo(input: {
  description?: string | null;
  imageUrl?: string | null;
  noindex?: boolean;
  path: string;
  publicOrigin: string;
  tenantName: string;
  title?: string | null;
}): StorefrontSeo {
  const canonicalUrl = new URL(normalizePath(input.path), `${input.publicOrigin}/`).toString();
  const pageName = input.title?.trim();
  const title = pageName ? `${pageName} · ${input.tenantName}` : input.tenantName;
  const description = input.description?.trim() || `Shop products from ${input.tenantName}.`;
  const imageUrl = input.imageUrl?.trim()
    ? new URL(input.imageUrl.trim(), `${input.publicOrigin}/`).toString()
    : undefined;

  return {
    canonicalUrl,
    description,
    ...(imageUrl ? { imageUrl } : {}),
    ...(input.noindex ? { noindex: true } : {}),
    title,
  };
}

function normalizePath(value: string) {
  const path = value.trim();
  return path.startsWith("/") ? path : `/${path}`;
}
