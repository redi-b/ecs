import {
  deriveLuviaPalette,
  type LuviaV1Data,
  type LuviaV1ThemeTokens,
  luviaV1DataSchema,
  luviaV1Defaults,
  luviaV1ThemeTokens,
  luviaV1ThemeTokensSchema,
} from "@ecs/storefront-templates";
import { normalizeStorefrontMediaUrl } from "../../../lib/media-url";

export function parseLuviaData(data: unknown): LuviaV1Data {
  const parsed = luviaV1DataSchema.safeParse(data);
  return parsed.success ? parsed.data : luviaV1Defaults;
}

export function parseLuviaThemeTokens(tokens: unknown): LuviaV1ThemeTokens {
  if (tokens && typeof tokens === "object") {
    const raw = tokens as Record<string, unknown>;
    const rawColors = (raw.colors && typeof raw.colors === "object" ? raw.colors : {}) as Record<
      string,
      unknown
    >;
    const primary = typeof rawColors.primary === "string" ? rawColors.primary : undefined;
    if (
      primary &&
      (!rawColors.background ||
        !rawColors.foreground ||
        !rawColors.muted ||
        !rawColors.accent ||
        raw.autoPalette !== false)
    ) {
      const derived = deriveLuviaPalette(primary);
      const enriched = {
        ...raw,
        autoPalette: raw.autoPalette ?? true,
        colors: {
          background:
            typeof rawColors.background === "string" && raw.autoPalette === false
              ? rawColors.background
              : derived.background,
          foreground:
            typeof rawColors.foreground === "string" && raw.autoPalette === false
              ? rawColors.foreground
              : derived.foreground,
          primary: derived.primary,
          muted:
            typeof rawColors.muted === "string" && raw.autoPalette === false
              ? rawColors.muted
              : derived.muted,
          accent:
            typeof rawColors.accent === "string" && raw.autoPalette === false
              ? rawColors.accent
              : derived.accent,
        },
      };
      const parsed = luviaV1ThemeTokensSchema.safeParse(enriched);
      if (parsed.success) return parsed.data;
    }
  }
  const parsed = luviaV1ThemeTokensSchema.safeParse(tokens);
  return parsed.success ? parsed.data : luviaV1ThemeTokens;
}

export function storefrontAsset(value: string | undefined, fallback: string) {
  return normalizeStorefrontMediaUrl(value) ?? fallback;
}
