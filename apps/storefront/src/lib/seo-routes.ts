import type { StorefrontError, StoreProduct, StoreProductsResponse } from "./commerce/types.js";

export const SITEMAP_PAGE_SIZE = 100;
export const MAX_SITEMAP_PRODUCTS = 10_000;

const publicRoutes = ["/", "/products", "/about", "/contact", "/request-item"] as const;
const privateRoutePrefixes = [
  "/account",
  "/actions",
  "/cart",
  "/checkout",
  "/internal",
  "/order",
  "/preview",
  "/wishlist",
] as const;

export function isPrivateStorefrontPath(pathname: string) {
  return privateRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export type SitemapProductPage = (input: {
  limit: number;
  offset: number;
}) => Promise<StoreProductsResponse | StorefrontError>;

export function buildTenantRobots(publicOrigin: string) {
  return [
    "User-agent: *",
    "Allow: /",
    ...privateRoutePrefixes.map((path) => `Disallow: ${path}`),
    `Sitemap: ${new URL("/sitemap.xml", `${publicOrigin}/`).toString()}`,
    "",
  ].join("\n");
}

export async function loadSitemapProductHandles(listPage: SitemapProductPage) {
  const productsById = new Map<string, StoreProduct>();
  let offset = 0;
  let count: number | null = null;
  let pageSize = SITEMAP_PAGE_SIZE;

  do {
    const page = await listPage({ limit: SITEMAP_PAGE_SIZE, offset });
    if (isStorefrontError(page)) return page;
    if (page.count != null) count ??= page.count;
    if (count != null && count > MAX_SITEMAP_PRODUCTS) {
      return {
        ok: false as const,
        status: 413,
        message: "The catalog is too large to build a sitemap synchronously.",
      };
    }
    for (const product of page.products) productsById.set(product.id, product);
    pageSize = page.products.length;
    offset += page.products.length;
    if (offset > MAX_SITEMAP_PRODUCTS) {
      return {
        ok: false as const,
        status: 413,
        message: "The catalog is too large to build a sitemap synchronously.",
      };
    }
    if (!page.products.length) break;
  } while (count != null ? offset < count : pageSize === SITEMAP_PAGE_SIZE);

  return {
    ok: true as const,
    handles: [...productsById.values()]
      .map((product) => product.handle?.trim())
      .filter((handle): handle is string => Boolean(handle))
      .sort((left, right) => left.localeCompare(right)),
  };
}

function isStorefrontError(
  value: StoreProductsResponse | StorefrontError,
): value is StorefrontError {
  return "ok" in value && value.ok === false;
}

export function buildTenantSitemap(
  publicOrigin: string,
  productHandles: string[],
  taxonomy: { collectionHandles?: string[]; categoryHandles?: string[] } = {},
) {
  const paths = [
    ...publicRoutes,
    ...productHandles.map((handle) => `/products/${encodeURIComponent(handle)}`),
    ...(taxonomy.collectionHandles ?? []).map(
      (handle) => `/products?collection=${encodeURIComponent(handle)}`,
    ),
    ...(taxonomy.categoryHandles ?? []).map(
      (handle) => `/products?category=${encodeURIComponent(handle)}`,
    ),
  ];
  const urls = [...new Set(paths)].map((path) => {
    const location = new URL(path, `${publicOrigin}/`).toString();
    return `  <url><loc>${escapeXml(location)}</loc></url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
