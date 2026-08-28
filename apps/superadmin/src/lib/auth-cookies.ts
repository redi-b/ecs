import { getAuthCookiePrefix, getAuthSessionCookieNames } from "@ecs/config/auth-cookies";

const DEFAULT_OPERATIONS_COOKIE_PREFIX = "ecs-ops";

export function getOperationsAuthCookiePrefix() {
  const configured = process.env.SUPERADMIN_AUTH_COOKIE_PREFIX?.trim();
  if (!configured) return DEFAULT_OPERATIONS_COOKIE_PREFIX;
  const normalized = getAuthCookiePrefix({ BETTER_AUTH_COOKIE_PREFIX: configured });
  return normalized === getAuthCookiePrefix() ? DEFAULT_OPERATIONS_COOKIE_PREFIX : normalized;
}

/** Convert Platform's auth response into an operations-only, host-scoped cookie. */
export function getOperationsAuthCookie(cookie: string) {
  if (!cookie.trim()) return cookie;

  const parts = cookie.split(";").map((part) => part.trim());
  const [pair, ...attributes] = parts;
  if (!pair) return cookie;
  const separator = pair.indexOf("=");
  if (separator < 1) return cookie;
  const platformName = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  const operationsName = translateCookieName(
    platformName,
    getAuthCookiePrefix(),
    getOperationsAuthCookiePrefix(),
  );
  const withoutScope = attributes.filter((part) => {
    const lower = part.toLowerCase();
    return !lower.startsWith("domain=") && !lower.startsWith("path=");
  });

  return [`${operationsName}=${value}`, ...withoutScope, "Path=/"].join("; ");
}

/** Forward only the operations session under Platform's expected cookie name. */
export function getPlatformAuthCookieHeader(cookieHeader: string | null | undefined) {
  if (!cookieHeader?.trim()) return "";
  const platformNames = new Set(getAuthSessionCookieNames(getAuthCookiePrefix()));
  const operationsNames = new Set(getAuthSessionCookieNames(getOperationsAuthCookiePrefix()));
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return [part];
      const name = part.slice(0, separator);
      const value = part.slice(separator + 1);
      if (platformNames.has(name)) return [];
      if (!operationsNames.has(name)) return [part];
      return [
        `${translateCookieName(name, getOperationsAuthCookiePrefix(), getAuthCookiePrefix())}=${value}`,
      ];
    })
    .join("; ");
}

export function getOperationsAuthCookieClears() {
  const domain = getFormerSharedCookieDomain();
  return getAuthSessionCookieNames(getOperationsAuthCookiePrefix()).flatMap((name) => {
    const secure = name.startsWith("__Secure-") ? "; Secure" : "";
    const attributes = `Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`;
    return [`${name}=; ${attributes}; Path=/`, `${name}=; ${attributes}; Domain=${domain}; Path=/`];
  });
}

function translateCookieName(name: string, fromPrefix: string, toPrefix: string) {
  const secure = name.startsWith("__Secure-");
  const plainName = secure ? name.slice("__Secure-".length) : name;
  const from = `${fromPrefix}.`;
  if (!plainName.startsWith(from)) return name;
  return `${secure ? "__Secure-" : ""}${toPrefix}.${plainName.slice(from.length)}`;
}

function getFormerSharedCookieDomain() {
  const explicit = process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN?.trim();
  if (explicit) return explicit.startsWith(".") ? explicit : `.${explicit}`;

  const hostname = new URL(
    process.env.SUPERADMIN_PUBLIC_BASE_URL ?? "http://ops.lvh.me",
  ).hostname.toLowerCase();
  const parts = hostname.split(".");
  return parts.length > 2 ? `.${parts.slice(1).join(".")}` : `.${hostname}`;
}
