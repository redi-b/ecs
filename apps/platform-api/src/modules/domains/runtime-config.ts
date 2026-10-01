import { isAbsolute } from "node:path";
import { createDomainDnsProbe } from "./dns-readiness.js";
import { renderDomainRoutes } from "./route-renderer.js";
import { createTraefikRouteVerifier } from "./traefik-verifier.js";

export function parseDomainRuntimeConfig(env: NodeJS.ProcessEnv) {
  const enabled = env.ECS_CUSTOM_DOMAINS_ENABLED === "true";
  if (env.ECS_CUSTOM_DOMAINS_ENABLED && !["true", "false"].includes(env.ECS_CUSTOM_DOMAINS_ENABLED))
    throw new Error("ECS_CUSTOM_DOMAINS_ENABLED must be true or false.");
  const directory = env.ECS_DOMAIN_ROUTE_DIRECTORY?.trim();
  const apiBaseUrl = env.ECS_DOMAIN_TRAEFIK_API_URL?.trim();
  const addresses = env.ECS_DOMAIN_INGRESS_IPV4?.trim();
  const service = env.ECS_DOMAIN_STOREFRONT_SERVICE?.trim();
  if (!enabled && !directory && !apiBaseUrl && !addresses && !service) return undefined;
  const missing = [
    ["ECS_DOMAIN_ROUTE_DIRECTORY", directory],
    ["ECS_DOMAIN_TRAEFIK_API_URL", apiBaseUrl],
    ["ECS_DOMAIN_INGRESS_IPV4", addresses],
    ["ECS_DOMAIN_STOREFRONT_SERVICE", service],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (!directory || !apiBaseUrl || !addresses || !service) {
    throw new Error(
      `Custom-domain infrastructure configuration is incomplete. Missing: ${missing.join(", ")}. Deploy the infra/dokploy/custom-domains.compose.yml overlay, or leave ECS_CUSTOM_DOMAINS_ENABLED=false with all domain infrastructure settings unset for local development.`,
    );
  }
  if (!isAbsolute(directory) || directory === "/")
    throw new Error("A dedicated absolute custom-domain route directory is required.");
  const ingressAddresses = [...new Set(addresses.split(",").map((address) => address.trim()))];
  if (ingressAddresses.length > 8)
    throw new Error("At most eight ingress addresses are supported.");
  const routeOptions = {
    service,
    resolver: env.ECS_DOMAIN_CERT_RESOLVER?.trim() || "letsencrypt",
    platformBaseDomain: env.STOREFRONT_PUBLIC_BASE_DOMAIN?.trim() || "ecset.dev",
  };
  // Reuse the real boundaries' validation without DNS/network/file operations.
  createDomainDnsProbe({ ingressAddresses });
  renderDomainRoutes([], routeOptions);
  createTraefikRouteVerifier({ apiBaseUrl, routeOptions });
  return { enabled, directory, apiBaseUrl, ingressAddresses, routeOptions };
}
