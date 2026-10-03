import { selectableStorefrontTemplates } from "@ecs/storefront-templates";

const selectableDemoSlugs = new Set(
  selectableStorefrontTemplates.map((template) => template.slug.toLowerCase()),
);

export const STOREFRONT_DEMO_TEMPLATE_COOKIE = "ecs_demo_template";

export function isStorefrontDemoPath(pathname: string) {
  return pathname === "/demo" || pathname.startsWith("/demo/");
}

export function getSelectableStorefrontDemoSlugs() {
  return [...selectableDemoSlugs];
}

export function resolveBrandedStorefrontDemoPath({
  demoHost,
  hostname,
  pathname,
}: {
  demoHost?: string | null;
  hostname: string;
  pathname: string;
}) {
  const expectedHost = demoHost?.trim().toLowerCase();
  if (!expectedHost || hostname.trim().toLowerCase() !== expectedHost) return null;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  const [rawSlug] = pathname.slice(1).split("/");
  if (!rawSlug) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug).toLowerCase();
  } catch {
    return null;
  }
  if (!selectableDemoSlugs.has(slug)) return null;
  const suffix = pathname.slice(rawSlug.length + 1);
  return `/demo/storefront/${slug}${suffix}`;
}

export function resolveCookieStorefrontDemoPath({
  demoHost,
  hostname,
  pathname,
  templateSlug,
}: {
  demoHost?: string | null;
  hostname: string;
  pathname: string;
  templateSlug?: string | null;
}) {
  const expectedHost = demoHost?.trim().toLowerCase();
  const slug = templateSlug?.trim().toLowerCase();
  if (!expectedHost || hostname.trim().toLowerCase() !== expectedHost) return null;
  if (!slug || !selectableDemoSlugs.has(slug)) return null;
  if (!pathname.startsWith("/") || pathname.startsWith("//") || isStorefrontDemoPath(pathname))
    return null;
  // Keep the selected template in the public URL. The middleware rewrites the
  // branded path internally, but visitors should never see the implementation
  // route under /demo/storefront.
  return `/${slug}${pathname === "/" ? "" : pathname}`;
}
