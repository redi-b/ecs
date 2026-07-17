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
