import {
  deriveNexahubPalette,
  type NexahubV1Data,
  type NexahubV1ThemeTokens,
  nexahubV1DataSchema,
  nexahubV1Defaults,
  nexahubV1ThemeTokens,
  nexahubV1ThemeTokensSchema,
} from "@ecs/storefront-templates";
import { normalizeStorefrontMediaUrl } from "../../../lib/media-url";

export function parseNexahubData(data: unknown): NexahubV1Data {
  const parsed = nexahubV1DataSchema.safeParse(data);
  if (!parsed.success) return structuredClone(nexahubV1Defaults);
  // Rendering must preserve the saved revision exactly. Silent copy migrations
  // here made the editor, its publication badge, and the live shop disagree.
  return parsed.data;
}

export function parseNexahubThemeTokens(tokens: unknown): NexahubV1ThemeTokens {
  if (tokens && typeof tokens === "object") {
    const raw = tokens as Record<string, unknown>;
    const rawColors = (raw.colors && typeof raw.colors === "object" ? raw.colors : {}) as Record<string, unknown>;
    const primary = typeof rawColors.primary === "string" ? rawColors.primary : undefined;
    if (primary && (!rawColors.background || !rawColors.foreground || !rawColors.muted || !rawColors.accent || raw.autoPalette !== false)) {
      const derived = deriveNexahubPalette(primary);
      const enriched = {
        ...raw,
        autoPalette: raw.autoPalette ?? true,
        colors: {
          background: typeof rawColors.background === "string" && raw.autoPalette === false ? rawColors.background : derived.background,
          foreground: typeof rawColors.foreground === "string" && raw.autoPalette === false ? rawColors.foreground : derived.foreground,
          primary: derived.primary,
          muted: typeof rawColors.muted === "string" && raw.autoPalette === false ? rawColors.muted : derived.muted,
          accent: typeof rawColors.accent === "string" && raw.autoPalette === false ? rawColors.accent : derived.accent,
        },
      };
      const parsed = nexahubV1ThemeTokensSchema.safeParse(enriched);
      if (parsed.success) return parsed.data;
    }
  }
  const parsed = nexahubV1ThemeTokensSchema.safeParse(tokens);
  return parsed.success ? parsed.data : nexahubV1ThemeTokens;
}

export function nexahubAsset(value: string | undefined, fallback: string) {
  return normalizeStorefrontMediaUrl(value) ?? fallback;
}
