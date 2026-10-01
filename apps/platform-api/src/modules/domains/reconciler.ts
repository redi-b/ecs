import { type DomainDiagnostics, domainCaaRestrictionSchema } from "@ecs/contracts";
import type { DomainCaaResult } from "./caa-readiness.js";
import type { DomainDnsResult } from "./dns-readiness.js";
import type { DomainHttpsResult } from "./https-readiness.js";
import type { DomainLifecycleEvidence } from "./lifecycle.js";
import type { createDomainReconciliationRepository } from "./reconciliation-repository.js";
import { canPublishDomainRoute } from "./route-eligibility.js";
import type { createDomainRoutePublisher } from "./route-publisher.js";
import { renderDomainRoutes } from "./route-renderer.js";

type Identity = { domainId: string; tenantId: string };
type Outcome =
  | {
      outcome: "disabled" | "domain_not_found" | "entitlement_required" | "busy" | "domain_changed";
    }
  | { outcome: "retry"; reason: string }
  | { outcome: "caa_restricted"; reason: string }
  | { outcome: "updated"; status: string; changed: boolean; retryReason?: string };

export function createDomainReconciler(options: {
  repository: ReturnType<typeof createDomainReconciliationRepository>;
  publisher: ReturnType<typeof createDomainRoutePublisher>;
  routeOptions: Parameters<typeof renderDomainRoutes>[1];
  enabled: () => boolean;
  hasEntitlement: (tenantId: string) => Promise<boolean>;
  probeDns: (input: { hostname: string; ownershipValue: string }) => Promise<DomainDnsResult>;
  probeCaa: (hostname: string) => Promise<DomainCaaResult>;
  probeHttps: (
    input: Identity & { hostname: string; addresses?: string[] },
  ) => Promise<DomainHttpsResult>;
  verifyRoutes: (hostnames: readonly string[]) => Promise<void>;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const publishDesired = async () =>
    options.repository.runExclusive(async (store) => {
      const routes = options.enabled() ? await store.listRouteDomains(now()) : [];
      const entitlement = new Map<string, boolean>();
      const hostnames: string[] = [];
      for (const route of routes) {
        if (!entitlement.has(route.tenantId))
          entitlement.set(route.tenantId, await options.hasEntitlement(route.tenantId));
        if (entitlement.get(route.tenantId)) hostnames.push(route.hostname);
      }
      const publication = await options.publisher.publish(
        renderDomainRoutes(hostnames, options.routeOptions),
        () => options.verifyRoutes(hostnames),
      );
      await store.finalizeRemovals(now());
      return publication;
    });

  const observe = async (input: Identity): Promise<Outcome> => {
    if (!options.enabled()) return { outcome: "disabled" };
    const candidate = await options.repository.findProbeCandidate(input);
    if (!candidate) return { outcome: "domain_not_found" };
    if (!(await options.hasEntitlement(input.tenantId))) return { outcome: "entitlement_required" };
    const { domain } = candidate;
    const persistDiagnostic = async (
      reason: DomainDiagnostics["reason"],
      detail: DomainDiagnostics["detail"] = null,
    ): Promise<Outcome | undefined> => {
      const recorded = await options.repository.runExclusive((store) =>
        store.recordDiagnostic({
          ...input,
          expectedDomain: domain,
          diagnostic: { checkedAt: new Date(now()).toISOString(), reason, detail },
        }),
      );
      if (!recorded.acquired) return { outcome: "busy" };
      if (!recorded.value.ok) return { outcome: recorded.value.error };
      return undefined;
    };
    const dns = await options.probeDns({
      hostname: domain.hostname,
      ownershipValue: candidate.ownershipValue,
    });
    if (!dns.ok)
      return (await persistDiagnostic(dns.error)) ?? { outcome: "retry", reason: dns.error };
    if (dns.ownership && dns.dns === "ready") {
      const caa = await options.probeCaa(domain.hostname);
      if (!caa.ok)
        return (await persistDiagnostic(caa.error)) ?? { outcome: "retry", reason: caa.error };
      if (!caa.allowed)
        return (
          (await persistDiagnostic(
            "caa_restricted",
            domainCaaRestrictionSchema.parse(caa.reason),
          )) ?? { outcome: "caa_restricted", reason: caa.reason }
        );
    }
    let https: DomainLifecycleEvidence["https"] = "pending";
    let retryReason: string | undefined;
    if (dns.dns !== "unsafe" && canPublishDomainRoute(domain, now())) {
      const result = await options.probeHttps({
        ...input,
        hostname: domain.hostname,
        // During DNS grace probe only the operator's configured ingress; never
        // the foreign/missing DNS answers. The HTTPS adapter pins those targets.
        ...(dns.dns === "ready" ? { addresses: dns.readyAddresses } : {}),
      });
      if (!result.ok) {
        if (dns.ownership && dns.dns === "ready")
          return (
            (await persistDiagnostic(result.error)) ?? { outcome: "retry", reason: result.error }
          );
        // Record confirmed DNS/TXT breakage now, independently of a transient
        // TLS outage. Preserve prior TLS evidence without claiming a new check.
        https = "not_observed";
        retryReason = result.error;
      } else https = result.https;
    }
    const applied = await options.repository.runExclusive((store) =>
      store.apply({
        ...input,
        expectedDomain: domain,
        now: now(),
        evidence: { ownership: dns.ownership, dns: dns.dns, https },
      }),
    );
    if (!applied.acquired) return { outcome: "busy" };
    if (!applied.value.ok) return { outcome: applied.value.error };
    return {
      outcome: "updated",
      status: applied.value.domain.status,
      changed: applied.value.changed,
      ...(retryReason ? { retryReason } : {}),
    };
  };

  return {
    publishDesired,
    remove: async (input: Identity & { userId: string }) => {
      const requested = await options.repository.runExclusive((store) =>
        store.markRemoving({ ...input, now: now() }),
      );
      if (!requested.acquired) return { outcome: "busy" as const };
      if (!requested.value.ok) return { outcome: "domain_not_found" as const };
      // Admission denial is committed before the second locked publication.
      // Publication failures leave the durable tombstone for scan/replay repair.
      try {
        const routing = await publishDesired();
        return {
          outcome: routing.acquired ? ("removed" as const) : ("removing" as const),
          changed: requested.value.changed,
          routing,
        };
      } catch {
        // The request already committed. Do not pretend removal failed wholly
        // or leak internal provider errors; the scheduled desired-state scan
        // repairs withdrawal and a merchant replay uses the same tombstone.
        return { outcome: "removing" as const, changed: requested.value.changed };
      }
    },
    reconcileOne: async (input: Identity) => {
      const outcome = await observe(input);
      // The readiness transaction above is committed before publication or a
      // later HTTPS request. Reread routing under lock, not from probe snapshots.
      // Also reconcile routing on retry, so elapsed grace still withdraws.
      const routing = await publishDesired();
      return { ...outcome, routing };
    },
  };
}
