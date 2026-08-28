import { selectableStorefrontTemplates } from "@ecs/storefront-templates";

const selectableDemoSlugs = new Set(
  selectableStorefrontTemplates.map((template) => template.slug.toLowerCase()),
);

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
