import type { MerchantDashboardAccess, StorefrontTemplateCatalogItem } from "@ecs/contracts";

import type { MessageKey } from "@/i18n/messages";

export function getSelectedTemplateName(
  templates: StorefrontTemplateCatalogItem[],
  summary: MerchantDashboardAccess,
  notSelectedLabel = "Not selected",
) {
  const selected = templates.find(
    (template) =>
      template.version.templateKey === summary.storefront.templateKey ||
      template.id === summary.storefront.templateId,
  );

  return (
    selected?.name ??
    summary.storefront.templateKey ??
    summary.storefront.templateId ??
    notSelectedLabel
  );
}

export function getTemplateTags(template: StorefrontTemplateCatalogItem) {
  return Array.isArray(template.tags)
    ? template.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 3)
    : [];
}

export function statusCopy(
  value: string,
  t?: (key: MessageKey) => string,
): string {
  if (value === "settings_updated") {
    return t ? t("settings.status.settingsUpdated") : "Settings saved.";
  }

  if (value === "template_selected") {
    return t ? t("settings.status.templateSelected") : "Storefront selected.";
  }

  if (value === "missing_template" || value === "missing_template_key") {
    return t ? t("settings.status.chooseStorefront") : "Choose a storefront before saving.";
  }

  if (value === "template_not_found" || value === "template_unavailable") {
    return t
      ? t("settings.status.templateUnavailable")
      : "That storefront is no longer available.";
  }

  return value.replaceAll("_", " ");
}

export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export type HandleAvailability =
  | { status: "idle" }
  | { status: "current" }
  | { status: "checking" }
  | { status: "available"; hostname?: string }
  | { status: "unavailable"; message: string }
  | { status: "invalid"; message: string };

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export function formatHandleReason(reason: string | undefined, t: Translate) {
  if (reason === "taken" || reason === "handle_unavailable") return t("settings.handle.taken");
  if (reason === "invalid" || reason === "invalid_handle") return t("settings.handle.invalid");
  if (reason === "reserved") return t("settings.handle.reserved");
  return t("settings.handle.notAvailable");
}
