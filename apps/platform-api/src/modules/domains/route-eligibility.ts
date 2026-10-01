import { DOMAIN_WARNING_GRACE_MS } from "./lifecycle.js";

type RoutableDomain = {
  type: string;
  status: string;
  verificationStatus: string;
  sslStatus: string;
  activatedAt: Date | null;
  warningSince: Date | null;
  warningReason: string | null;
};

/** Routing eligibility is not storefront admission: ACME needs a pending route. */
export function canPublishDomainRoute(domain: RoutableDomain, now: number) {
  if (!Number.isFinite(now) || now < 0) throw new Error("Invalid route snapshot timestamp.");
  if (domain.type !== "custom_domain" || domain.verificationStatus !== "verified") return false;
  if (domain.status === "pending_certificate") return true;
  const activation = domain.activatedAt?.getTime();
  if (
    activation === undefined ||
    !Number.isFinite(activation) ||
    activation < 0 ||
    activation > now
  )
    return false;
  if (domain.status === "active") return domain.sslStatus === "active";
  const warning = domain.warningSince?.getTime();
  return (
    domain.status === "misconfigured" &&
    warning !== undefined &&
    Number.isFinite(warning) &&
    warning >= activation &&
    warning <= now &&
    now - warning < DOMAIN_WARNING_GRACE_MS &&
    (domain.warningReason === "dns_missing" || domain.warningReason === "ownership_missing")
  );
}
