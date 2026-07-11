import { classicV1Defaults, classicV1ThemeTokens } from "./templates/classic/v1/defaults";
import { classicV1DataSchema } from "./templates/classic/v1/schema";

export const storefrontTemplates = [
  {
    id: "00000000-0000-4000-8000-000000000003",
    versionId: "00000000-0000-4000-8000-000000000004",
    slug: "classic",
    name: "Classic",
    description: "A clean storefront for a merchant's first online shop.",
    version: 1,
    templateKey: "classic@1",
    componentRegistryVersion: "built-in-v1",
    sourceHash: "classic@1",
    schema: classicV1DataSchema,
    defaultData: classicV1Defaults,
    defaultThemeTokens: classicV1ThemeTokens,
  },
] as const;
