const LEGACY_TEMPLATE_KEYS: Readonly<Record<string, string>> = {
  "mesob@1": "luvia@1",
};

/** Keeps already-published storefronts usable after a retired template is removed. */
export function resolveStorefrontTemplateKey(templateKey: string): string {
  return LEGACY_TEMPLATE_KEYS[templateKey] ?? templateKey;
}

/** Stable template identity used by DOM roots and scoped template CSS. */
export function storefrontTemplateSlug(templateKey: string): string {
  return resolveStorefrontTemplateKey(templateKey).split("@", 1)[0]!;
}

export function storefrontTemplateClassName(templateKey: string): string {
  return `template-${storefrontTemplateSlug(templateKey)}`;
}
