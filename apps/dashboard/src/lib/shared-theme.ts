import { getSharedParentCookieDomain } from "./shared-cookie-domain";

export const SHARED_THEME_COOKIE = "ecs-theme";

export type SharedTheme = "dark" | "light" | "system";

export function isSharedTheme(value: unknown): value is SharedTheme {
  return value === "dark" || value === "light" || value === "system";
}

export function getSharedThemeFromCookie(cookie = typeof document !== "undefined" ? document.cookie : ""): SharedTheme | null {
  const theme = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SHARED_THEME_COOKIE}=`))
    ?.split("=")[1];

  const decoded = theme ? decodeURIComponent(theme) : null;
  return isSharedTheme(decoded) ? decoded : null;
}

/** Parse Cookie header / next cookies().get value. */
export function parseSharedThemeCookieValue(value: string | undefined | null): SharedTheme | null {
  if (!value) return null;
  const decoded = decodeURIComponent(value.trim());
  return isSharedTheme(decoded) ? decoded : null;
}

export function setSharedThemeCookie(theme: SharedTheme) {
  const parts = [
    `${SHARED_THEME_COOKIE}=${encodeURIComponent(theme)}`,
    "Path=/",
    "Max-Age=31536000",
    "SameSite=Lax",
  ];
  const domain = getSharedParentCookieDomain({
    hostname: typeof window !== "undefined" ? window.location.hostname : null,
  });

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  // biome-ignore lint/suspicious/noDocumentCookie: Parent-domain cookie across dashboard and shop hosts.
  document.cookie = parts.join("; ");
}

/**
 * Blocking script: apply ecs-theme cookie before paint (avoids dark↔light FOUC
 * on first hit of a new subdomain when localStorage is empty).
 */
export function getThemeBootstrapScript(): string {
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${SHARED_THEME_COOKIE}=([^;]*)/);var t=m?decodeURIComponent(m[1]):"system";if(t!=="dark"&&t!=="light"&&t!=="system")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
}
