const LEGACY_TEMPLATE_KEYS: Readonly<Record<string, string>> = {
  "mesob@1": "luvia@1",
};

/** Keeps already-published storefronts usable after a retired template is removed. */
export function resolveStorefrontTemplateKey(templateKey: string): string {
  return LEGACY_TEMPLATE_KEYS[templateKey] ?? templateKey;
}
