import type { StorefrontSeoSettings } from "@ecs/contracts";

export type StorefrontSeoEditorValues = {
  description: string;
  socialImageUrl: string;
  title: string;
};

/** Keep null as "automatic" instead of turning inherited shop copy into an override. */
export function getStorefrontSeoEditorValues(
  seo: StorefrontSeoSettings,
): StorefrontSeoEditorValues {
  return {
    title: seo.title ?? "",
    description: seo.description ?? "",
    socialImageUrl: seo.socialImageUrl ?? "",
  };
}

export function resolveStorefrontSeoPreview(options: {
  fallbackDescription?: string | null | undefined;
  fallbackTitle: string;
  values: StorefrontSeoEditorValues;
}) {
  return {
    title: options.values.title.trim() || options.fallbackTitle,
    description: options.values.description.trim() || options.fallbackDescription?.trim() || "",
  };
}
