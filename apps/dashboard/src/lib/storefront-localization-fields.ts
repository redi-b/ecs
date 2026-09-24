import { createHash } from "node:crypto";
import type { StorefrontLocalizedContent, StorefrontSeoSettings } from "@ecs/contracts";
import {
  getStorefrontLocalizationManifest,
  getStorefrontTemplateTranslationDefaults,
} from "@ecs/storefront-templates";
import { isShopManagedStorefrontPath } from "./storefront-managed-fields";

export type StorefrontTranslationField = {
  id: string;
  label: string;
  path: string;
  sectionId: string;
  sectionLabel: string;
  source: string;
  defaultTranslation?: string;
};

export function getStorefrontTranslationFields(input: {
  data: unknown;
  seo?: StorefrontSeoSettings | undefined;
  templateKey: string;
}): StorefrontTranslationField[] {
  const manifest = getStorefrontLocalizationManifest(input.templateKey);
  if (!manifest) return [];

  const fields: StorefrontTranslationField[] = [];
  for (const field of manifest.fields) {
    if (isShopManagedStorefrontPath(field.path)) continue;
    if (field.localization !== "localized") continue;
    if (field.kind === "text" || field.kind === "textarea") {
      addField(fields, input.data, field.path, field.label, field.sectionId, field.sectionLabel);
      continue;
    }
    if (field.kind === "links") {
      const links = getPath(input.data, field.path);
      if (!Array.isArray(links)) continue;
      links.forEach((_, index) => {
        addField(
          fields,
          input.data,
          `${field.path}.${index}.label`,
          `${field.label} ${index + 1}`,
          field.sectionId,
          field.sectionLabel,
        );
      });
    }
  }
  if (input.seo?.title?.trim()) {
    fields.push({
      id: "seo:seo.title",
      label: "Shop title",
      path: "seo.title",
      sectionId: "seo",
      sectionLabel: "Search and sharing",
      source: input.seo.title,
    });
  }
  if (input.seo?.description?.trim()) {
    fields.push({
      id: "seo:seo.description",
      label: "Shop description",
      path: "seo.description",
      sectionId: "seo",
      sectionLabel: "Search and sharing",
      source: input.seo.description,
    });
  }
  const defaults = getStorefrontTemplateTranslationDefaults(input.templateKey, "am");
  return fields.map((field) => {
    const fallback = defaults[field.path];
    return fallback?.source === field.source
      ? { ...field, defaultTranslation: fallback.value }
      : field;
  });
}

export function getStorefrontTranslationStatus(input: {
  field: StorefrontTranslationField;
  localizedContent: StorefrontLocalizedContent;
  locale: "am";
}) {
  const translation = input.localizedContent.locales[input.locale]?.[input.field.path];
  if (!translation?.value.trim()) {
    return input.field.defaultTranslation ? ("ready" as const) : ("using_english" as const);
  }
  return translation.sourceHash === hashStorefrontSource(input.field.source)
    ? ("ready" as const)
    : ("needs_review" as const);
}

export function hashStorefrontSource(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function addField(
  target: StorefrontTranslationField[],
  data: unknown,
  path: string,
  label: string,
  sectionId: string,
  sectionLabel: string,
) {
  const value = getPath(data, path);
  if (typeof value !== "string" || !value.trim()) return;
  target.push({ id: `${sectionId}:${path}`, label, path, sectionId, sectionLabel, source: value });
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}
