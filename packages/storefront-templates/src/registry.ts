import { classicV1Defaults, classicV1ThemeTokens } from "./templates/classic/v1/defaults";
import {
  classicThemeTokensSchema,
  classicV1DataSchema,
} from "./templates/classic/v1/schema";
import { luviaV1Defaults, luviaV1ThemeTokens } from "./templates/luvia/v1/defaults";
import {
  luviaV1DataSchema,
  luviaV1ThemeTokensSchema,
} from "./templates/luvia/v1/schema";

export const storefrontTemplates = [
  {
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
  {
    id: "00000000-0000-4000-8000-000000000003",
    versionId: "00000000-0000-4000-8000-000000000004",
    slug: "classic",
    name: "Classic",
    description: "A polished shop layout for product browsing and checkout.",
    version: 1,
    templateKey: "classic@1",
    componentRegistryVersion: "built-in-v1",
    sourceHash: "classic@1",
    schema: classicV1DataSchema,
    themeSchema: classicThemeTokensSchema,
    defaultData: classicV1Defaults,
    defaultThemeTokens: classicV1ThemeTokens,
  },
] as const;

export function getStorefrontTemplateDefinition(templateKey: string) {
  return storefrontTemplates.find((template) => template.templateKey === templateKey);
}
