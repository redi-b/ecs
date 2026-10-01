import type { createPlatformDb } from "@ecs/db";
import type { TenantDomainRemovalResult } from "../../types/tenant.js";
import { createEntitlementService } from "../entitlements/service.js";
import { createDomainCaaProbe } from "./caa-readiness.js";
import { createDomainDnsProbe } from "./dns-readiness.js";
import { createDomainHttpsProbe } from "./https-readiness.js";
import { createDomainReconciler } from "./reconciler.js";
import { createDomainReconciliationRepository } from "./reconciliation-repository.js";
import { createDomainRoutePublisher } from "./route-publisher.js";
import { parseDomainRuntimeConfig } from "./runtime-config.js";
import { createTraefikRouteVerifier } from "./traefik-verifier.js";

export function createDomainRuntime(options: {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
}) {
  const config = parseDomainRuntimeConfig(options.env);
  if (!config) return undefined;
  const repository = createDomainReconciliationRepository(options.db);
  const entitlement = createEntitlementService(options.db);
  const reconciler = createDomainReconciler({
    repository,
    publisher: createDomainRoutePublisher({ directory: config.directory }),
    routeOptions: config.routeOptions,
    enabled: () => config.enabled,
    hasEntitlement: async (tenantId) =>
      (await entitlement.evaluate({ tenantId, key: "customDomains" })).allowed,
    probeDns: createDomainDnsProbe({ ingressAddresses: config.ingressAddresses }),
    probeCaa: createDomainCaaProbe(),
    probeHttps: createDomainHttpsProbe({ ingressAddresses: config.ingressAddresses }),
    verifyRoutes: createTraefikRouteVerifier({
      apiBaseUrl: config.apiBaseUrl,
      routeOptions: config.routeOptions,
    }),
  });
  return {
    ...reconciler,
    removeTenantDomain: async (input: {
      domainId: string;
      tenantId: string;
      userId: string;
    }): Promise<TenantDomainRemovalResult> => {
      const result = await reconciler.remove(input);
      if (result.outcome === "busy")
        return { ok: false, error: "domain_reconciliation_busy", status: 503 };
      if (result.outcome === "domain_not_found")
        return { ok: false, error: "domain_not_found", status: 404 };
      return { ok: true, status: result.outcome };
    },
    enabled: () => config.enabled,
    listPage: repository.listReconciliationPage,
  };
}
