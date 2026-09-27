const DEFAULT_PLATFORM_API_URL = "http://api.lvh.me";
const DEFAULT_DASHBOARD_URL = "http://app.lvh.me";

export type PublicPlan = {
  badge: string | null;
  billingInterval: "day" | "week" | "month" | "year";
  code: string;
  ctaLabel: string;
  currency: string;
  description: string;
  displayOrder: number;
  featureList: string[];
  featured: boolean;
  name: string;
  price: string;
  summary: string;
  trial:
    | { available: false }
    | {
        activation: "automatic" | "manual";
        available: true;
        durationDays: number;
        paymentMethodRequired: boolean;
      };
};

export type PublicTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: {
    demoUrl?: string | null;
    previewAltText?: string | null;
    previewUrl?: string | null;
    templateKey: string;
    version: number;
  };
};

export function getPlatformApiUrl() {
  return (process.env.PLATFORM_API_BASE_URL || DEFAULT_PLATFORM_API_URL).replace(/\/$/, "");
}

export function getDashboardUrls() {
  const base = (process.env.PUBLIC_DASHBOARD_URL || DEFAULT_DASHBOARD_URL).replace(/\/$/, "");
  return {
    dashboard: `${base}/dashboard`,
    demo: `${base}/demo`,
    signIn: `${base}/sign-in`,
    signUp: `${base}/sign-up`,
  };
}

export async function getPublicCatalogs() {
  const [plans, templates] = await Promise.all([
    fetchCatalog("/platform/billing/plans", parsePlans),
    fetchCatalog("/platform/storefront/templates", parseTemplates),
  ]);

  return { plans, templates };
}

async function fetchCatalog<T>(path: string, parse: (value: unknown) => T[]): Promise<T[]> {
  try {
    const response = await fetch(`${getPlatformApiUrl()}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3_500),
    });
    if (!response.ok) {
      console.warn(`[ECS catalog] ${path} returned ${response.status}`);
      return [];
    }
    return parse(await response.json());
  } catch {
    return [];
  }
}

function parsePlans(value: unknown): PublicPlan[] {
  if (!isRecord(value) || !Array.isArray(value.plans)) return [];
  return value.plans.filter(isPublicPlan).sort((a, b) => a.displayOrder - b.displayOrder);
}

function parseTemplates(value: unknown): PublicTemplate[] {
  if (!isRecord(value) || !Array.isArray(value.templates)) return [];
  return value.templates.filter(isPublicTemplate);
}

function isPublicPlan(value: unknown): value is PublicPlan {
  if (!isRecord(value) || !isRecord(value.trial)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.price === "string" &&
    typeof value.currency === "string" &&
    typeof value.description === "string" &&
    typeof value.summary === "string" &&
    typeof value.ctaLabel === "string" &&
    typeof value.displayOrder === "number" &&
    typeof value.featured === "boolean" &&
    Array.isArray(value.featureList) &&
    value.featureList.every((item) => typeof item === "string") &&
    ["day", "week", "month", "year"].includes(String(value.billingInterval)) &&
    typeof value.trial.available === "boolean"
  );
}

function isPublicTemplate(value: unknown): value is PublicTemplate {
  return (
    isRecord(value) &&
    isRecord(value.version) &&
    typeof value.id === "string" &&
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.version.templateKey === "string" &&
    typeof value.version.version === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
