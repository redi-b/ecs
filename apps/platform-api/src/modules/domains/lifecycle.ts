import {
  type CustomDomainLifecycleStatus,
  customDomainLifecycleStatusSchema,
} from "@ecs/contracts";

export type DomainLifecycleState = {
  status: CustomDomainLifecycleStatus;
  activatedAt: number | null;
  failureSince: number | null;
  httpsVerified?: boolean;
};
export type DomainLifecycleEvidence = {
  ownership: boolean;
  dns: "ready" | "missing" | "unsafe";
  // valid means BOTH public certificate/SNI trust and expected-shop probe pass.
  // not_observed is a transient HTTPS failure, never new activation evidence.
  https: "valid" | "pending" | "invalid" | "wrong_shop" | "not_observed";
};
export type DomainLifecycleDecision = DomainLifecycleState & {
  routeDesired: boolean;
  admitStorefront: boolean;
  reason:
    | "ready"
    | "ownership_missing"
    | "dns_missing"
    | "https_pending"
    | "removal"
    | "unsafe_dns"
    | "wrong_shop";
};

export const DOMAIN_WARNING_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function decideDomainLifecycle(
  state: DomainLifecycleState,
  evidence: DomainLifecycleEvidence,
  now: number,
): DomainLifecycleDecision {
  customDomainLifecycleStatusSchema.parse(state.status);
  if (
    !Number.isFinite(now) ||
    now < 0 ||
    [state.activatedAt, state.failureSince].some(
      (value) => value !== null && (!Number.isFinite(value) || value < 0 || value > now),
    )
  )
    throw new Error("Invalid domain lifecycle timestamp.");
  const base = { ...state, routeDesired: false, admitStorefront: false };
  if (state.status === "removing") return { ...base, reason: "removal" };
  if (evidence.dns === "unsafe") return { ...base, status: "failed", reason: "unsafe_dns" };
  if (evidence.https === "wrong_shop") return { ...base, status: "failed", reason: "wrong_shop" };
  if (
    (state.status === "active" || state.status === "misconfigured") &&
    state.activatedAt !== null &&
    (!evidence.ownership || evidence.dns === "missing")
  ) {
    const failureSince = state.failureSince ?? now;
    const grace = now - failureSince < DOMAIN_WARNING_GRACE_MS;
    return {
      ...base,
      status: "misconfigured",
      failureSince,
      routeDesired: grace,
      admitStorefront:
        grace &&
        (evidence.https === "valid" ||
          (evidence.https === "not_observed" && state.httpsVerified === true)),
      reason: !evidence.ownership ? "ownership_missing" : "dns_missing",
    };
  }
  if (!evidence.ownership)
    return { ...base, status: "pending_verification", reason: "ownership_missing" };
  if (evidence.dns !== "ready") return { ...base, status: "pending_dns", reason: "dns_missing" };
  if (evidence.https !== "valid")
    return { ...base, status: "pending_certificate", routeDesired: true, reason: "https_pending" };
  return {
    ...base,
    status: "active",
    activatedAt: state.activatedAt ?? now,
    failureSince: null,
    routeDesired: true,
    admitStorefront: true,
    reason: "ready",
  };
}
