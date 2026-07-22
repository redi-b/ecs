import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";

import type { MessageKey } from "@/i18n/messages";

export type HandleState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "available"; message: string; hostname: string }
  | { status: "unavailable"; message: string };

export const ONBOARDING_DRAFT_KEY = "ecs:onboarding-draft";

export const BUSINESS_CATEGORY_OPTIONS = [
  "Groceries",
  "Fashion",
  "Electronics",
  "Beauty & personal care",
  "Home & living",
  "Food & restaurants",
  "Health & pharmacy",
  "Sports & outdoors",
  "Books & stationery",
  "Services",
  "Other",
] as const;

export function parseCategories(value: string | undefined) {
  if (!value?.trim()) return [] as string[];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Keep backend as a single string field (max ~80 in contracts). */
export function serializeCategories(values: string[]) {
  const joined = values.map((value) => value.trim()).filter(Boolean).join(", ");
  return joined.slice(0, 80);
}

export function getTemplateTags(template: StorefrontTemplateCatalogItem | null | undefined) {
  const tags = template?.tags;
  return Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string").slice(0, 4)
    : [];
}

export function getHandleReason(reason: string | undefined, t: (key: MessageKey) => string) {
  if (reason === "taken") return t("onboarding.handle.taken");
  if (reason === "reserved") return t("onboarding.handle.reserved");
  if (reason === "invalid") return t("onboarding.handle.invalid");
  return t("onboarding.handle.unavailable");
}

export function mapOnboardingError(code: string | undefined, t: (key: MessageKey) => string) {
  const messages: Record<string, MessageKey> = {
    auth_required: "onboarding.error.authRequired",
    commerce_backend_unavailable: "onboarding.error.provisioningFailed",
    commerce_credentials_invalid: "onboarding.error.commerceCredentials",
    commerce_credentials_missing: "onboarding.error.commerceCredentials",
    handle_invalid: "onboarding.handle.invalid",
    handle_reserved: "onboarding.handle.reserved",
    handle_taken: "onboarding.error.handleTaken",
    invalid_shop_setup: "onboarding.error.invalidSetup",
    invalid_tenant_creation_response: "onboarding.error.invalidResponse",
    missing_handle: "onboarding.error.required",
    missing_name: "onboarding.error.required",
    missing_required_fields: "onboarding.error.required",
    platform_request_failed: "onboarding.error.platformUnavailable",
    storefront_template_unavailable: "onboarding.error.storefrontUnavailable",
    template_unavailable: "onboarding.error.templateUnavailable",
    tenant_handle_taken: "onboarding.error.handleTaken",
    tenant_provisioning_failed: "onboarding.error.provisioningFailed",
    tenant_provisioning_unavailable: "onboarding.error.provisioningUnavailable",
  };
  return t(messages[code ?? ""] ?? "onboarding.error.failed");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
