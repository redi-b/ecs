import { type DomainProbeIdentity, domainProbeIdentitySchema } from "@ecs/contracts";
import type { EntitlementDecision } from "../entitlements/service.js";
import { DOMAIN_WARNING_GRACE_MS } from "./lifecycle.js";
import { isValidCustomDomainHostname } from "./service.js";

type ProbeDomain = {
  hostname: string;
  domainId: string;
  tenantId: string;
  tenantStatus: string;
  domainType?: string;
  verificationStatus: string;
  domainStatus: string;
  sslStatus?: string;
  activatedAt?: Date | null;
  warningSince?: Date | null;
  warningReason?: string | null;
};

export function createDomainProbeIdentityService(options: {
  enabled?: boolean;
  platformBaseDomain: string;
  findDomainByHostname: (hostname: string) => Promise<ProbeDomain | undefined>;
  evaluateEntitlement: (input: {
    tenantId: string;
    key: "customDomains";
  }) => Promise<EntitlementDecision>;
}) {
  const platformBaseDomain = options.platformBaseDomain.trim().toLowerCase().replace(/\.$/, "");
  return async (input: {
    hostname: string;
    nonce: string;
  }): Promise<DomainProbeIdentity | undefined> => {
    if (
      options.enabled !== true ||
      !isValidCustomDomainHostname(input.hostname) ||
      !/^[a-f0-9]{32}$/.test(input.nonce) ||
      input.hostname.endsWith(".et") ||
      input.hostname === platformBaseDomain ||
      input.hostname.endsWith(`.${platformBaseDomain}`)
    )
      return undefined;
    const row = await options.findDomainByHostname(input.hostname);
    if (
      !row ||
      row.hostname !== input.hostname ||
      row.domainType !== "custom_domain" ||
      row.verificationStatus !== "verified" ||
      row.tenantStatus !== "active"
    )
      return undefined;
    const now = Date.now();
    const activated = row.activatedAt?.getTime();
    const warning = row.warningSince?.getTime();
    const existing =
      activated !== undefined &&
      Number.isFinite(activated) &&
      activated >= 0 &&
      activated <= now &&
      row.sslStatus === "active";
    const grace =
      existing &&
      warning !== undefined &&
      Number.isFinite(warning) &&
      warning >= activated &&
      warning <= now &&
      now - warning < DOMAIN_WARNING_GRACE_MS &&
      (row.warningReason === "ownership_missing" || row.warningReason === "dns_missing");
    if (
      row.domainStatus !== "pending_certificate" &&
      !(row.domainStatus === "active" && existing) &&
      !(row.domainStatus === "misconfigured" && grace)
    )
      return undefined;
    if (
      !(await options.evaluateEntitlement({ tenantId: row.tenantId, key: "customDomains" })).allowed
    )
      return undefined;
    const identity = domainProbeIdentitySchema.safeParse({
      version: 1,
      hostname: row.hostname,
      tenantId: row.tenantId,
      domainId: row.domainId,
      nonce: input.nonce,
    });
    return identity.success ? identity.data : undefined;
  };
}
