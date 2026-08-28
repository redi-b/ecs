export function getPrimaryDomainRedirect(input: {
  method: string;
  platformBaseDomain: string;
  primaryHostname: string;
  requestUrl: URL;
}) {
  if (input.method !== "GET" && input.method !== "HEAD") return null;
  const current = normalizeHostname(input.requestUrl.hostname);
  const primary = normalizeHostname(input.primaryHostname);
  const base = normalizeHostname(input.platformBaseDomain);
  if (!current || !primary || !base || current === primary) return null;

  // The managed platform address is the emergency fallback. Never redirect it
  // into a custom-domain outage loop.
  if (current === base || current.endsWith(`.${base}`)) return null;

  const target = new URL(input.requestUrl);
  target.hostname = primary;
  target.port = "";
  return target;
}

function normalizeHostname(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}
