import {
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
  const parsed = nexahubV1ThemeTokensSchema.safeParse(tokens);
  return parsed.success ? parsed.data : nexahubV1ThemeTokens;
}

export function nexahubAsset(value: string | undefined, fallback: string) {
  return normalizeStorefrontMediaUrl(value) ?? fallback;
}
