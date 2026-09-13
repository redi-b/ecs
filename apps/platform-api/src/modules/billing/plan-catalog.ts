import { definePlanEntitlements, type PlanEntitlements } from "../entitlements/catalog.js";

/** Stable UUIDs keep default-plan synchronization idempotent across deployments. */
export const DEFAULT_PLAN_IDS = {
  starter: "a1000000-0000-4000-8000-000000000001",
  growth: "a1000000-0000-4000-8000-000000000002",
} as const;

type DefaultPlanDefinition = {
  code: string;
  id: (typeof DEFAULT_PLAN_IDS)[keyof typeof DEFAULT_PLAN_IDS];
  name: string;
  price: string;
  status: "active";
  /** Only enforced quotas belong here. Do not publish aspirational limits. */
  limits: Record<string, never>;
  features: PlanEntitlements;
  kind: "standard";
  visibility: "public";
};

export const DEFAULT_PLAN_CATALOG = {
  starter: {
    id: DEFAULT_PLAN_IDS.starter,
    code: "starter",
    name: "Starter",
    price: "0",
    status: "active",
    limits: {},
    features: definePlanEntitlements({ customDomains: false }),
    kind: "standard",
    visibility: "public",
  },
  growth: {
    id: DEFAULT_PLAN_IDS.growth,
    code: "growth",
    name: "Growth",
    price: "2499",
    status: "active",
    limits: {},
    features: definePlanEntitlements({ customDomains: false }),
    kind: "standard",
    visibility: "public",
  },
} as const satisfies Record<keyof typeof DEFAULT_PLAN_IDS, DefaultPlanDefinition>;

export const DEFAULT_PLANS = Object.freeze(Object.values(DEFAULT_PLAN_CATALOG));
