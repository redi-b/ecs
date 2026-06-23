import ClassicV1Home from "./classic/v1/Home.astro";

export const storefrontRenderers = {
  "classic@1": {
    Home: ClassicV1Home,
  },
} as const;

export function getStorefrontRenderer(templateKey: string) {
  return storefrontRenderers[templateKey as keyof typeof storefrontRenderers];
}
