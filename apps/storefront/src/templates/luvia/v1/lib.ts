import { luviaV1DataSchema, luviaV1Defaults, type LuviaV1Data } from "@ecs/storefront-templates";

export function parseLuviaData(data: unknown): LuviaV1Data {
  const parsed = luviaV1DataSchema.safeParse(data);
  return parsed.success ? parsed.data : luviaV1Defaults;
}

export function storefrontAsset(value: string | undefined, fallback: string) {
  return value?.startsWith("http://") || value?.startsWith("https://") || value?.startsWith("/")
    ? value
    : fallback;
}
