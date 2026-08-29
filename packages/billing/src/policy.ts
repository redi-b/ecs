import type {
  CapabilityCatalog,
  CapabilityDefinition,
  DecisionReason,
  EntitlementDecision,
  SubscriptionStatus,
} from "./domain.js";

const ACCESS_STATUSES = new Set<string>(["trialing", "active"] satisfies SubscriptionStatus[]);

function decision(input: {
  allowed: boolean;
  capability: string;
  reason: DecisionReason;
  remaining?: number | null;
  source?: EntitlementDecision["source"];
}): EntitlementDecision {
  return {
    allowed: input.allowed,
    capability: input.capability,
    reason: input.reason,
    remaining: input.remaining ?? null,
    source: input.source ?? "none",
  };
}

export function decideCapability(input: {
  amount?: number;
  capability: string;
  definition: CapabilityDefinition | undefined;
  reserved: number;
  status: SubscriptionStatus | string | null;
  used: number;
  value: unknown;
}): EntitlementDecision {
  if (!input.status) {
    return decision({
      allowed: false,
      capability: input.capability,
      reason: "subscription_missing",
    });
  }
  if (!ACCESS_STATUSES.has(input.status)) {
    return decision({
      allowed: false,
      capability: input.capability,
      reason: "subscription_inactive",
    });
  }
  if (!input.definition) {
    return decision({
      allowed: false,
      capability: input.capability,
      reason: "invalid_configuration",
    });
  }
  if (input.definition.kind === "boolean") {
    return typeof input.value === "boolean" && input.value
      ? decision({ allowed: true, capability: input.capability, reason: "allowed", source: "plan" })
      : decision({
          allowed: false,
          capability: input.capability,
          reason:
            typeof input.value === "boolean" ? "capability_disabled" : "invalid_configuration",
        });
  }

  const amount = input.amount ?? 1;
  if (
    typeof input.value !== "number" ||
    !Number.isSafeInteger(input.value) ||
    input.value < 0 ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    input.used < 0 ||
    input.reserved < 0
  ) {
    return decision({
      allowed: false,
      capability: input.capability,
      reason: "invalid_configuration",
    });
  }
  const remaining = Math.max(0, input.value - input.used - input.reserved);
  return decision({
    allowed: remaining >= amount,
    capability: input.capability,
    reason: remaining >= amount ? "limit_available" : "limit_exhausted",
    remaining,
    source: "plan",
  });
}

export function parsePlanCapabilities<TCatalog extends CapabilityCatalog>(
  catalog: TCatalog,
  persisted: unknown,
): { readonly [TKey in keyof TCatalog]: boolean | number } {
  const source =
    persisted && typeof persisted === "object" && !Array.isArray(persisted)
      ? (persisted as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    Object.entries(catalog).map(([key, definition]) => {
      const value = source[key];
      if (definition.kind === "boolean") {
        return [key, typeof value === "boolean" ? value : false];
      }
      return [
        key,
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0,
      ];
    }),
  ) as { readonly [TKey in keyof TCatalog]: boolean | number };
}
