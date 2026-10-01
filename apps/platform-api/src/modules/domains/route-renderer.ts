import { createHash } from "node:crypto";
import { isReservedCustomDomainHostname, isValidCustomDomainHostname } from "./hostname.js";

type DomainRouteOptions = {
  service: string;
  resolver: string;
  platformBaseDomain?: string;
};

/** Render an authorized desired set; syntax validity alone never grants ownership. */
export function renderDomainRoutes(hostnames: readonly string[], options: DomainRouteOptions) {
  const { service, resolver } = options;
  if (!/^[a-z0-9-]+@(docker|file)$/.test(service ?? "")) {
    throw new Error("An explicit provider-qualified storefront service is required.");
  }
  if (!/^[a-z0-9-]+$/.test(resolver ?? "")) {
    throw new Error("An explicit certificate resolver is required.");
  }
  const platformBaseDomain = options.platformBaseDomain ?? "ecset.dev";
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(platformBaseDomain)) {
    throw new Error("An exact canonical platform hostname is required.");
  }
  const hosts = [...new Set(hostnames)].sort();
  for (const hostname of hosts) {
    if (
      typeof hostname !== "string" ||
      !isValidCustomDomainHostname(hostname) ||
      isReservedCustomDomainHostname(hostname, platformBaseDomain)
    ) {
      throw new Error("Invalid or reserved hostname.");
    }
  }
  // Keep a valid, harmless middleware when the last route is removed. Traefik's
  // YAML decoder rejects standalone empty http/router objects.
  const lines = ["http:"];
  if (hosts.length) lines.push("  routers:");
  for (const hostname of hosts) {
    const id = createHash("sha256").update(hostname).digest("hex").slice(0, 20);
    for (const secure of [false, true]) {
      lines.push(
        `    ecs-domain-${id}-${secure ? "https" : "http"}:`,
        `      rule: 'Host(\`${hostname}\`)'`,
        `      entryPoints: [${secure ? "websecure" : "web"}]`,
        "      priority: 100",
        `      service: ${service}`,
      );
      if (secure) lines.push("      tls:", `        certResolver: ${resolver}`);
      else lines.push("      middlewares: [ecs-domain-https-redirect]");
    }
  }
  lines.push(
    "  middlewares:",
    "    ecs-domain-https-redirect:",
    "      redirectScheme:",
    "        scheme: https",
    "        permanent: true",
  );
  // An unused middleware identifies the exact accepted generation, including
  // empty snapshots. It is never attached to merchant requests or responses.
  const fingerprint = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 32);
  lines.push(
    `    ecs-domain-snapshot-${fingerprint}:`,
    "      headers:",
    "        customRequestHeaders:",
    `          X-ECS-Route-Snapshot: '${fingerprint}'`,
  );
  return `${lines.join("\n")}\n`;
}
