import { luviaV1Defaults, luviaV1ThemeTokens } from "./templates/luvia/v1/defaults";
import { luviaV1DataSchema, luviaV1ThemeTokensSchema } from "./templates/luvia/v1/schema";
import { nexahubV1Defaults, nexahubV1ThemeTokens } from "./templates/nexahub/v1/defaults";
import { nexahubV1DataSchema, nexahubV1ThemeTokensSchema } from "./templates/nexahub/v1/schema";

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
    homeCatalog: {
      featuredProductsPath: "home.featuredProducts",
      catalogProductsPath: "home.products",
      heroProductIdPaths: ["home.hero.featuredProductId", "home.hero.featuredProductIds"],
      featuredCollectionPath: "home.featuredCollection",
      categoriesPath: "home.categories",
      allowUnselectedProductFallback: true,
    },
    schema: luviaV1DataSchema,
    themeSchema: luviaV1ThemeTokensSchema,
    defaultData: luviaV1Defaults,
    defaultThemeTokens: luviaV1ThemeTokens,
  },
  {
    availability: "selectable",
    id: "00000000-0000-4000-8000-000000000007",
    versionId: "00000000-0000-4000-8000-000000000008",
    slug: "nexahub",
    name: "NexaHub",
    description: "A precise technology storefront with editorial product merchandising.",
    version: 1,
    templateKey: "nexahub@1",
    componentRegistryVersion: "built-in-v1",
    sourceHash: "45b7d8e0968c5d1811b1a6c91a4240380a8026c9",
    homeCatalog: {
      featuredProductsPath: "home.bestSellers",
      heroProductIdPaths: ["home.featuredItem.productIds", "home.featuredItem.productId"],
      categoriesPath: "home.categories",
      allowUnselectedProductFallback: true,
    },
    schema: nexahubV1DataSchema,
    themeSchema: nexahubV1ThemeTokensSchema,
    defaultData: nexahubV1Defaults,
    defaultThemeTokens: nexahubV1ThemeTokens,
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
