import { ENTITLEMENT_KEYS, type EntitlementKey } from "@ecs/contracts";
import { defineCapabilityCatalog, parsePlanCapabilities } from "@ecs/billing";

export type { EntitlementKey } from "@ecs/contracts";
export { ENTITLEMENT_KEYS } from "@ecs/contracts";

export const ENTITLEMENT_CATALOG = defineCapabilityCatalog({
  customDomains: {
    kind: "boolean",
    defaultValue: false,
  },
} as const);

export const BILLING_CAPABILITY_CATALOG = defineCapabilityCatalog({
  ...ENTITLEMENT_CATALOG,
  products: {
    kind: "limit",
    defaultValue: 0,
    window: "lifetime",
  },
} as const);

export type PlanCapabilities = {
  customDomains: boolean;
  products: number;
};

export function composePlanCapabilities(features: unknown, limits: unknown): PlanCapabilities {
  const parsedFeatures = parsePlanCapabilities(ENTITLEMENT_CATALOG, features) as PlanEntitlements;
  const source =
    limits && typeof limits === "object" && !Array.isArray(limits)
      ? (limits as Record<string, unknown>)
      : {};
  return parsePlanCapabilities(BILLING_CAPABILITY_CATALOG, {
    ...parsedFeatures,
    products: source.products,
  }) as PlanCapabilities;
}

export type PlanEntitlements = Record<EntitlementKey, boolean>;

export function isEntitlementKey(value: string): value is EntitlementKey {
  return Object.hasOwn(ENTITLEMENT_CATALOG, value);
}

/**
 * Plan feature JSON is untrusted persisted data. Missing, unknown, and non-boolean
 * values fail closed so adding a pricing label never grants access by accident.
 */
export function parsePlanEntitlements(value: unknown): PlanEntitlements {
  return parsePlanCapabilities(ENTITLEMENT_CATALOG, value) as PlanEntitlements;
}

/** Keeps seeded/default plan declarations aligned with the capability catalog. */
export function definePlanEntitlements(value: PlanEntitlements): PlanEntitlements {
  return value;
}
