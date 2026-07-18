import {
  classicThemeTokensSchema,
  classicV1DataSchema,
  type ClassicThemeTokens,
  type ClassicV1Data,
} from "@ecs/storefront-templates";

import type { ShellTheme } from "../../../lib/theme";

export function parseClassicData(data: unknown, tenantName: string): ClassicV1Data {
  const parsed = classicV1DataSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  return classicV1DataSchema.parse({
    header: { navigation: [{ label: "Shop", href: "/products" }] },
    home: {
      hero: {
        title: tenantName,
        primaryCtaLabel: "Shop",
        primaryCtaHref: "/products",
      },
      featuredProducts: { title: "Featured", productIds: [] },
    },
    footer: { socialLinks: [] },
  });
}

export function parseClassicTheme(themeTokens: unknown): ClassicThemeTokens {
  const parsed = classicThemeTokensSchema.safeParse(themeTokens);
  if (parsed.success) return parsed.data;
  return classicThemeTokensSchema.parse({
    colors: {
      background: "#0b0f0d",
      foreground: "#e6ebe4",
      primary: "#9bc4a0",
      muted: "#141a16",
      accent: "#d4785a",
    },
    typography: { headingFont: "Syne", bodyFont: "Outfit" },
    radius: "sm",
  });
}

export function classicShellTheme(theme: ClassicThemeTokens): ShellTheme & { accent?: string } {
  const radius =
    theme.radius === "none" ? "0px" : theme.radius === "md" ? "14px" : "10px";
  return {
    background: theme.colors.background,
    foreground: theme.colors.foreground,
    primary: theme.colors.primary,
    muted: theme.colors.muted,
    headingFont: theme.typography.headingFont,
    bodyFont: theme.typography.bodyFont,
    radius,
    ...(theme.colors.accent ? { accent: theme.colors.accent } : {}),
  };
}

export function isImageUrl(value: string | undefined) {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}
