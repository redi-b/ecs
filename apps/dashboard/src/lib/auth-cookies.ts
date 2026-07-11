const defaultSharedCookieDomain = ".lvh.me";
const betterAuthSessionCookieNames = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export function getSharedAuthCookie(cookie: string) {
  if (!cookie.trim()) {
    return cookie;
  }

  const sharedDomain = getSharedCookieDomain();
  const parts = cookie.split(";").map((part) => part.trim());
  const withoutScopedAttributes = parts.filter((part) => {
    const lowerPart = part.toLowerCase();

    return !lowerPart.startsWith("domain=") && !lowerPart.startsWith("path=");
  });

  return [...withoutScopedAttributes, `Domain=${sharedDomain}`, "Path=/"].join("; ");
}

export function getSharedAuthCookieClears() {
  const sharedDomain = getSharedCookieDomain();

  return betterAuthSessionCookieNames.map((name) => {
    const secure = name.startsWith("__Secure-") ? "; Secure" : "";

    return `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}; Domain=${sharedDomain}; Path=/`;
  });
}

function getSharedCookieDomain() {
  const value = process.env.DASHBOARD_AUTH_COOKIE_DOMAIN?.trim();

  if (value) {
    return value.startsWith(".") ? value : `.${value}`;
  }

  const dashboardUrl = process.env.DASHBOARD_PUBLIC_BASE_URL ?? "http://dashboard.lvh.me";

  try {
    const hostname = new URL(dashboardUrl).hostname.toLowerCase();
    const parts = hostname.split(".");

    return parts.length > 2 ? `.${parts.slice(1).join(".")}` : `.${hostname}`;
  } catch {
    return defaultSharedCookieDomain;
  }
}
