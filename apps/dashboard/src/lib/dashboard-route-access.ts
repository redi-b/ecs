import { type AccessRequirement, allows, merchantPolicies } from "@/lib/access-policy";
import { dashboardRoutes } from "@/lib/routes";

export type DashboardRouteRequirement = AccessRequirement;

const PAGE_REQUIREMENTS: ReadonlyArray<{
  matches: (pathname: string) => boolean;
  requirement: DashboardRouteRequirement;
}> = [
  {
    matches: (pathname) => pathname === dashboardRoutes.overview,
    requirement: merchantPolicies.overview,
  },
  {
    matches: (pathname) => /\/dashboard\/products\/(categories|collections)\/new$/.test(pathname),
    requirement: { allOf: ["products.read", "products.create"] },
  },
  {
    matches: (pathname) => /\/dashboard\/products\/[^/]+\/edit$/.test(pathname),
    requirement: { allOf: ["products.read", "products.update"] },
  },
  {
    matches: (pathname) =>
      pathname === dashboardRoutes.products || pathname.startsWith("/dashboard/products/"),
    requirement: merchantPolicies.products,
  },
  {
    matches: (pathname) =>
      pathname === dashboardRoutes.orders || pathname.startsWith("/dashboard/orders/"),
    requirement: merchantPolicies.orders,
  },
  {
    matches: (pathname) =>
      pathname === dashboardRoutes.customers || pathname.startsWith("/dashboard/customers/"),
    requirement: merchantPolicies.customers,
  },
  {
    matches: (pathname) => pathname === dashboardRoutes.inquiries,
    requirement: merchantPolicies.inquiries,
  },
  {
    matches: (pathname) => pathname === dashboardRoutes.promotions,
    requirement: merchantPolicies.promotions,
  },
  {
    matches: (pathname) => pathname === dashboardRoutes.media,
    requirement: merchantPolicies.media,
  },
  {
    matches: (pathname) => pathname === dashboardRoutes.editor,
    requirement: merchantPolicies.storefront,
  },
  {
    matches: (pathname) =>
      pathname === dashboardRoutes.insights || pathname.startsWith("/dashboard/insights/"),
    requirement: merchantPolicies.insights,
  },
  {
    matches: (pathname) => pathname === dashboardRoutes.billing,
    requirement: merchantPolicies.billing,
  },
  {
    matches: (pathname) => pathname === dashboardRoutes.notifications,
    requirement: merchantPolicies.notifications,
  },
  // Personal account settings remain available to every active shop member.
  {
    matches: (pathname) => pathname === dashboardRoutes.settings,
    requirement: merchantPolicies.settings,
  },
];

export function getDashboardRouteRequirement(pathOrUrl: string) {
  const pathname = new URL(pathOrUrl, "https://dashboard.local").pathname.replace(/\/$/, "") || "/";
  return PAGE_REQUIREMENTS.find((entry) => entry.matches(pathname))?.requirement ?? null;
}

export function canAccessDashboardRoute(
  pathOrUrl: string,
  permissions: ReadonlySet<string> | readonly string[],
) {
  const requirement = getDashboardRouteRequirement(pathOrUrl);
  if (!requirement) return false;
  return allows(permissions, requirement);
}

export function getFirstPermittedDashboardHref(permissions: readonly string[]) {
  const available = new Set(permissions);
  const candidates = [
    dashboardRoutes.overview,
    dashboardRoutes.orders,
    dashboardRoutes.products,
    dashboardRoutes.customers,
    dashboardRoutes.inquiries,
    dashboardRoutes.promotions,
    dashboardRoutes.media,
    dashboardRoutes.editor,
    dashboardRoutes.insights,
    dashboardRoutes.billing,
    dashboardRoutes.settings,
  ];
  return (
    candidates.find((href) => canAccessDashboardRoute(href, available)) ?? dashboardRoutes.settings
  );
}
