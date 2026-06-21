import { classicV1Defaults, classicV1ThemeTokens } from "./templates/classic/v1/defaults.js";
import { classicV1DataSchema } from "./templates/classic/v1/schema.js";

export const storefrontTemplates = [
  {
    slug: "classic",
    name: "Classic",
    description: "A clean storefront for a merchant's first online shop.",
    version: 1,
    templateKey: "classic@1",
    schema: classicV1DataSchema,
    defaultData: classicV1Defaults,
    defaultThemeTokens: classicV1ThemeTokens,
  },
] as const;
