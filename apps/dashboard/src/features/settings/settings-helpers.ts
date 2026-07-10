import type { MerchantDashboardSummary, StorefrontTemplateCatalogItem } from "@ecs/contracts";

export function getSelectedTemplateName(
  templates: StorefrontTemplateCatalogItem[],
  summary: MerchantDashboardSummary,
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
    "Not selected"
  );
}

export function getTemplateTags(template: StorefrontTemplateCatalogItem) {
  return Array.isArray(template.tags)
    ? template.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 3)
    : [];
}

export function statusCopy(value: string) {
  if (value === "settings_updated") {
    return "Settings saved.";
  }

  if (value === "template_selected") {
    return "Storefront selected.";
  }

  if (value === "missing_template" || value === "missing_template_key") {
    return "Choose a storefront before saving.";
  }

  if (value === "template_not_found" || value === "template_unavailable") {
    return "That storefront is no longer available.";
  }

  return value.replaceAll("_", " ");
}
