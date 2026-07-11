export function normalizeStorefrontBaseDomain(value: string) {
  return value
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
}

export function getStorefrontHostname(handle: string, baseDomain: string) {
  return `${handle}.${normalizeStorefrontBaseDomain(baseDomain)}`;
}
