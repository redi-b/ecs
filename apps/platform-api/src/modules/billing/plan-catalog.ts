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

/**
 * Truthful public copy for the built-in plans. Database presentation rows override
 * this completely, so operators can change or hide a plan without a deployment.
 */
export const DEFAULT_PLAN_PRESENTATIONS = {
  starter: {
    badge: null,
    ctaLabel: "Start free",
    description: "Everything you need to open and run your first online shop.",
    displayOrder: 0,
    featureList: [
      "Hosted online storefront",
      "Product and inventory management",
      "Orders and customer management",
      "Store performance insights",
    ],
    featured: false,
    publicName: "Starter",
    summary: "Start selling online with no monthly fee.",
  },
  growth: {
    badge: "For growing shops",
    ctaLabel: "Choose Growth",
    description: "Keep your shop running with a paid monthly subscription.",
    displayOrder: 1,
    featureList: [
      "Everything in Starter",
      "Product and inventory management",
      "Orders and customer management",
      "Store performance insights",
    ],
    featured: true,
    publicName: "Growth",
    summary: "A monthly plan for your growing shop.",
  },
} as const;

export type DefaultPlanCode = keyof typeof DEFAULT_PLAN_PRESENTATIONS;

export function getDefaultPlanPresentation(code: string) {
  return Object.hasOwn(DEFAULT_PLAN_PRESENTATIONS, code)
    ? DEFAULT_PLAN_PRESENTATIONS[code as DefaultPlanCode]
    : null;
}
