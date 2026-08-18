import { luviaV1Defaults, luviaV1ThemeTokens } from "./templates/luvia/v1/defaults";
import {
  luviaV1DataSchema,
  luviaV1ThemeTokensSchema,
} from "./templates/luvia/v1/schema";

export const storefrontTemplates = [
  {
    availability: "selectable",
    id: "00000000-0000-4000-8000-000000000005",
    versionId: "00000000-0000-4000-8000-000000000006",
    slug: "luvia",
    name: "Luvia",
    description: "An editorial beauty storefront with immersive merchandising.",
    version: 1,
    templateKey: "luvia@1",
    componentRegistryVersion: "built-in-v1",
    sourceHash: "ab6e0fe09018472d96874fe9cd4dd0e7e5129bd2",
    schema: luviaV1DataSchema,
    themeSchema: luviaV1ThemeTokensSchema,
    defaultData: luviaV1Defaults,
    defaultThemeTokens: luviaV1ThemeTokens,
  },
] as const;

/** Templates merchants may choose for a new storefront or template switch. */
export const selectableStorefrontTemplates = storefrontTemplates.filter(
  (template) => template.availability === "selectable",
);

/** Canonical compile-time key set consumed by storefront and editor registries. */
export type StorefrontTemplateKey = (typeof storefrontTemplates)[number]["templateKey"];

export function getStorefrontTemplateDefinition(templateKey: string) {
  return storefrontTemplates.find((template) => template.templateKey === templateKey);
}
