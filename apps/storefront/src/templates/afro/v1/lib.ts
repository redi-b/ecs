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

/** The subset of a variant the PDP needs to price and submit a selection. */
export type AfroVariantOption = {
  id: string;
  inStock: boolean;
  priceAmount: number | null;
  currencyCode: string | null;
  optionValues: Record<string, string>;
};

/**
 * Resolve the shopper's option choices to one real variant.
 *
 * This is the money path: the hidden `variantId` is whatever comes back, so a
 * loose match here means the wrong size or colour lands in the cart. Every axis
 * the shopper picked must therefore match exactly, and an incomplete or
 * unsatisfiable selection resolves to `null` so the caller can disable the
 * submit button rather than fall back to a default variant.
 */
export function resolveAfroVariant<T extends AfroVariantOption>(
  variants: readonly T[],
  selected: Record<string, string | undefined>,
): T | null {
  const chosen = Object.entries(selected).filter(
    (pair): pair is [string, string] => typeof pair[1] === "string" && pair[1] !== "",
  );
  // A product with no options has nothing to resolve; the caller keeps the
  // server-rendered default variant in that case.
  if (!chosen.length) return null;
  return (
    variants.find((variant) => {
      // The axis sets must be identical, not merely a subset. A variant carrying
      // axes the shopper never chose (picking "S" but not a colour) is not a
      // confirmed match, and matching it would sell an arbitrary colour.
      const axes = Object.entries(variant.optionValues);
      if (axes.length !== chosen.length) return false;
      return chosen.every(([title, value]) => variant.optionValues[title] === value);
    }) ?? null
  );
}
