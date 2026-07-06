export const SHARED_THEME_COOKIE = "ecs-theme";

export type SharedTheme = "dark" | "light" | "system";

export function getSharedThemeFromCookie(cookie = document.cookie): SharedTheme | null {
  const theme = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SHARED_THEME_COOKIE}=`))
    ?.split("=")[1];

  if (theme === "dark" || theme === "light" || theme === "system") {
    return theme;
  }

  return null;
}

export function setSharedThemeCookie(theme: SharedTheme) {
  const parts = [`${SHARED_THEME_COOKIE}=${theme}`, "Path=/", "Max-Age=31536000", "SameSite=Lax"];
  const domain = getSharedCookieDomain(window.location.hostname);

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  // biome-ignore lint/suspicious/noDocumentCookie: This needs parent-domain cookie support across dashboard and shop subdomains.
  document.cookie = parts.join("; ");
}

function getSharedCookieDomain(hostname: string) {
  if (hostname === "localhost" || /^[\d.]+$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split(".").filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return `.${parts.slice(-2).join(".")}`;
}
