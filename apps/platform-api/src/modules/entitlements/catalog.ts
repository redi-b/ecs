import { ENTITLEMENT_KEYS, type EntitlementKey } from "@ecs/contracts";

export type { EntitlementKey } from "@ecs/contracts";
export { ENTITLEMENT_KEYS } from "@ecs/contracts";

export const ENTITLEMENT_CATALOG = {
  customDomains: {
    defaultAllowed: false,
  },
} as const;

export type PlanEntitlements = Record<EntitlementKey, boolean>;

export function isEntitlementKey(value: string): value is EntitlementKey {
  return Object.hasOwn(ENTITLEMENT_CATALOG, value);
}

/**
 * Plan feature JSON is untrusted persisted data. Missing, unknown, and non-boolean
 * values fail closed so adding a pricing label never grants access by accident.
 */
export function parsePlanEntitlements(value: unknown): PlanEntitlements {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return Object.fromEntries(
    ENTITLEMENT_KEYS.map((key) => [
      key,
      typeof source[key] === "boolean" ? source[key] : ENTITLEMENT_CATALOG[key].defaultAllowed,
    ]),
  ) as PlanEntitlements;
}

/** Keeps seeded/default plan declarations aligned with the capability catalog. */
export function definePlanEntitlements(value: PlanEntitlements): PlanEntitlements {
  return value;
}
