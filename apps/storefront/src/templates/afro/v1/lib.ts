import {
  type AfroV1Data,
  type AfroV1ThemeTokens,
  afroV1DataSchema,
  afroV1Defaults,
  afroV1ThemeTokens,
  afroV1ThemeTokensSchema,
} from "@ecs/storefront-templates";
import { normalizeStorefrontMediaUrl } from "../../../lib/media-url";

export function parseAfroData(data: unknown): AfroV1Data {
  const parsed = afroV1DataSchema.safeParse(data);
  if (!parsed.success) return structuredClone(afroV1Defaults);
  return parsed.data;
}

export function parseAfroThemeTokens(tokens: unknown): AfroV1ThemeTokens {
  const parsed = afroV1ThemeTokensSchema.safeParse(tokens);
  return parsed.success ? parsed.data : afroV1ThemeTokens;
}

export function afroAsset(value: string | undefined, fallback: string) {
  return normalizeStorefrontMediaUrl(value) ?? fallback;
}
