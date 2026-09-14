import type { PlatformOnboardingState, PlatformTenant } from "@ecs/contracts";

export const LAST_SHOP_COOKIE_NAME = "ecs_last_shop";

export function getLastShopId(cookieHeader?: string | null) {
  if (!cookieHeader) return null;
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LAST_SHOP_COOKIE_NAME}=`));
  if (!entry) return null;
  const value = decodeURIComponent(entry.slice(LAST_SHOP_COOKIE_NAME.length + 1)).trim();
  return value || null;
}

export type ShopDestination =
  | { kind: "onboarding"; href: "/admin/onboarding" }
  | { kind: "picker"; href: "/admin/shops" }
  | { kind: "shop"; href: string; tenantId: string };

/** Onboarding is a valid terminal page for accounts with unfinished shops. */
export function getOnboardingExit(destination: ShopDestination): string | null {
  return destination.kind === "onboarding" ? null : destination.href;
}

export function getShopDashboardUrl(hostname: string, protocol: string) {
  const normalizedProtocol = protocol.replace(":", "") === "https" ? "https" : "http";
  return `${normalizedProtocol}://${hostname}/admin`;
}

export function resolveShopDestination(input: {
  lastShopId?: string | null;
  protocol: string;
  state: PlatformOnboardingState;
}): ShopDestination {
  const available = input.state.tenants.filter(isAvailableShop);
  if (available.length === 0) return { kind: "onboarding", href: "/admin/onboarding" };

  const remembered = input.lastShopId
    ? available.find((tenant) => tenant.id === input.lastShopId)
    : undefined;
  if (remembered) return toShopDestination(remembered, input.protocol);
  const [onlyShop] = available;
  if (onlyShop && available.length === 1) return toShopDestination(onlyShop, input.protocol);
  return { kind: "picker", href: "/admin/shops" };
}

export function isAvailableShop(
  tenant: PlatformTenant,
): tenant is PlatformTenant & { primaryDomain: { hostname: string } } {
  return tenant.status === "active" && Boolean(tenant.primaryDomain.hostname?.trim());
}

function toShopDestination(
  tenant: PlatformTenant & { primaryDomain: { hostname: string } },
  protocol: string,
): ShopDestination {
  return {
    kind: "shop",
    href: getShopDashboardUrl(tenant.primaryDomain.hostname, protocol),
    tenantId: tenant.id,
  };
}
