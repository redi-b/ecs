import { getSharedParentCookieDomain } from "./shared-cookie-domain";

export const SHARED_THEME_COOKIE = "ecs-theme";

export type SharedTheme = "dark" | "light" | "system";

export function isSharedTheme(value: unknown): value is SharedTheme {
  return value === "dark" || value === "light" || value === "system";
}

export function getSharedThemeFromCookie(
  cookie = typeof document !== "undefined" ? document.cookie : "",
): SharedTheme | null {
  // Prefer the last matching cookie when host-only + Domain= both exist.
  const matches = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SHARED_THEME_COOKIE}=`))
    .map((part) => {
      const raw = part.slice(`${SHARED_THEME_COOKIE}=`.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    });

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const value = matches[i];
    if (isSharedTheme(value)) return value;
  }
  return null;
}

/** Parse Cookie header / next cookies().get value. */
export function parseSharedThemeCookieValue(value: string | undefined | null): SharedTheme | null {
  if (!value) return null;
  const raw = value.trim();
  try {
    const decoded = decodeURIComponent(raw);
    return isSharedTheme(decoded) ? decoded : null;
  } catch {
    return isSharedTheme(raw) ? raw : null;
  }
}

function expireThemeCookie(options: { domain?: string | null }) {
  const parts = [`${SHARED_THEME_COOKIE}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  // biome-ignore lint/suspicious/noDocumentCookie: clear stale host/Domain variants
  document.cookie = parts.join("; ");
}

/**
 * Persist theme for this host and (when configured) parent domain so shop.*
 * subdomains share preference. Clears older host-only copies that can shadow
 * Domain= cookies in production and freeze the toggle.
 */
export function setSharedThemeCookie(theme: SharedTheme) {
  if (typeof document === "undefined") return;

  const domain = getSharedParentCookieDomain({
    hostname: typeof window !== "undefined" ? window.location.hostname : null,
  });

  // Host-only cookie (no Domain) can win over Domain=.parent and never update
  // correctly when we only rewrite the parent cookie — clear both first.
  expireThemeCookie({ domain: null });
  if (domain) {
    expireThemeCookie({ domain });
  }

  const parts = [
    `${SHARED_THEME_COOKIE}=${encodeURIComponent(theme)}`,
    "Path=/",
    "Max-Age=31536000",
    "SameSite=Lax",
  ];
  if (domain) {
    parts.push(`Domain=${domain}`);
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure");
  }

  // biome-ignore lint/suspicious/noDocumentCookie: Parent-domain cookie across dashboard and shop hosts.
  document.cookie = parts.join("; ");
}

/**
 * Blocking script: apply ecs-theme cookie before paint (avoids dark↔light FOUC
 * on first hit of a new subdomain when localStorage is empty).
 */
export function getThemeBootstrapScript(): string {
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${SHARED_THEME_COOKIE}=([^;]*)/g);var t="system";if(m&&m.length){var last=m[m.length-1].split("=")[1];t=decodeURIComponent(last||"system");}if(t!=="dark"&&t!=="light"&&t!=="system")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
}
