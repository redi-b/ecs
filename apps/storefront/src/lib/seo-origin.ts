import type { PublishedStorefrontConfig } from "@ecs/contracts";

export type StorefrontPublicScheme = "http" | "https";

export function getStorefrontPublicOrigin(
  config: PublishedStorefrontConfig,
  configuredScheme = process.env.STOREFRONT_PUBLIC_SCHEME,
) {
  const hostname = normalizeTrustedHostname(config.tenant.primaryDomain.hostname);
  const scheme = resolvePublicScheme(hostname, configuredScheme);
  return `${scheme}://${hostname}`;
}

function resolvePublicScheme(hostname: string, configuredScheme?: string): StorefrontPublicScheme {
  const normalized = configuredScheme?.trim().toLowerCase();
  if (normalized === "http" || normalized === "https") return normalized;
  if (normalized) throw new Error("invalid_storefront_public_scheme");
  return isLocalHostname(hostname) ? "http" : "https";
}

function normalizeTrustedHostname(value: string) {
  const hostname = value.trim().replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname.includes(":") || hostname.includes("/") || hostname.includes("@")) {
    throw new Error("invalid_storefront_primary_hostname");
  }
  return hostname;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".lvh.me")
  );
}
