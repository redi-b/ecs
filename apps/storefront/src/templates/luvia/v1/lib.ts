import {
  luviaV1DataSchema,
  luviaV1Defaults,
  luviaV1ThemeTokens,
  luviaV1ThemeTokensSchema,
  type LuviaV1Data,
  type LuviaV1ThemeTokens,
} from "@ecs/storefront-templates";

export function parseLuviaData(data: unknown): LuviaV1Data {
  const parsed = luviaV1DataSchema.safeParse(data);
  return parsed.success ? parsed.data : luviaV1Defaults;
}

export function parseLuviaThemeTokens(tokens: unknown): LuviaV1ThemeTokens {
  const parsed = luviaV1ThemeTokensSchema.safeParse(tokens);
  return parsed.success ? parsed.data : luviaV1ThemeTokens;
}

export function storefrontAsset(value: string | undefined, fallback: string) {
  return value?.startsWith("http://") || value?.startsWith("https://") || value?.startsWith("/")
    ? value
    : fallback;
}
