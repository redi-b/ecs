import { customDomainLifecycleStatusSchema, type TenantDomainContract } from "@ecs/contracts";

export function domainConnectionStatus(domain: TenantDomainContract) {
  const parsed = customDomainLifecycleStatusSchema.safeParse(domain.status);
  return parsed.success ? parsed.data : "failed";
}

export function canUseDomain(domain: TenantDomainContract) {
  return (
    domain.status === "active" &&
    domain.verificationStatus === "verified" &&
    domain.sslStatus === "active"
  );
}

export function initialChallengeExpired(domain: TenantDomainContract, now: number) {
  return (
    domain.type === "custom_domain" &&
    domain.status === "pending_verification" &&
    domain.verificationStatus === "pending" &&
    Boolean(domain.verificationChallenge) &&
    Date.parse(domain.verificationChallenge?.expiresAt ?? "") <= now
  );
}

// Syntax feedback only. Public suffixes, reservations, ownership, entitlement
// and routing eligibility are enforced by the tenant-scoped Platform API.
export function normalizeDomainInput(
  value: string,
  platformBaseDomain = "ecset.dev",
): string | null {
  const input = value.trim().replace(/\.$/, "").toLowerCase();
  if (!input || /[\s/:?#@\\%]/u.test(input)) return null;
  let hostname: string;
  try {
    hostname = new URL(`https://${input}`).hostname;
  } catch {
    return null;
  }
  const labels = hostname.split(".");
  if (
    hostname.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    !/[a-z]/.test(labels.at(-1) ?? "") ||
    hostname.endsWith(".et") ||
    hostname === platformBaseDomain ||
    hostname.endsWith(`.${platformBaseDomain}`)
  )
    return null;
  return hostname;
}
