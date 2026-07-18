/** Extract primary color from published theme tokens when present. */
export function getPrimaryColor(themeTokens: unknown): string | undefined {
  if (
    typeof themeTokens === "object" &&
    themeTokens &&
    "colors" in themeTokens &&
    typeof (themeTokens as { colors?: { primary?: string } }).colors?.primary === "string"
  ) {
    return (themeTokens as { colors: { primary: string } }).colors.primary;
  }
  return undefined;
}

export type ShellTheme = {
  background?: string;
  foreground?: string;
  primary?: string;
  muted?: string;
  headingFont?: string;
  bodyFont?: string;
  radius?: string;
};

/** Map published theme tokens → CSS variables for StoreShell / commerce pages. */
export function themeFromTokens(themeTokens: unknown): ShellTheme {
  if (!themeTokens || typeof themeTokens !== "object") return {};
  const t = themeTokens as {
    colors?: { background?: string; foreground?: string; primary?: string; muted?: string };
    typography?: { headingFont?: string; bodyFont?: string };
    radius?: "none" | "sm" | "md";
  };
  const radius =
    t.radius === "none" ? "0px" : t.radius === "md" ? "18px" : t.radius === "sm" ? "14px" : undefined;
  return {
    ...(t.colors?.background ? { background: t.colors.background } : {}),
    ...(t.colors?.foreground ? { foreground: t.colors.foreground } : {}),
    ...(t.colors?.primary ? { primary: t.colors.primary } : {}),
    ...(t.colors?.muted ? { muted: t.colors.muted } : {}),
    ...(t.typography?.headingFont ? { headingFont: t.typography.headingFont } : {}),
    ...(t.typography?.bodyFont ? { bodyFont: t.typography.bodyFont } : {}),
    ...(radius ? { radius } : {}),
  };
}

export function shellStyle(theme: ShellTheme, primaryColor?: string): string | undefined {
  const primary = theme.primary ?? primaryColor;
  const parts = [
    theme.background ? `--sf-bg: ${theme.background}` : null,
    theme.foreground ? `--sf-fg: ${theme.foreground}` : null,
    primary ? `--sf-primary: ${primary}` : null,
    theme.muted ? `--sf-muted: ${theme.muted}` : null,
    theme.headingFont ? `--sf-heading-font: ${theme.headingFont}` : null,
    theme.bodyFont ? `--sf-body-font: ${theme.bodyFont}` : null,
    theme.radius ? `--sf-radius: ${theme.radius}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : undefined;
}
