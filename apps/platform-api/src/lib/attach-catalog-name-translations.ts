import type { CatalogNameTranslation } from "@ecs/contracts";

const emptyTranslation = (): CatalogNameTranslation => ({
  locale: "am",
  status: "using_english",
  title: null,
});

export async function attachCatalogNameTranslations<T extends { id: string }>(input: {
  items: T[];
  resourceType: "product" | "product_category" | "product_collection";
  summarizeNames?:
    | ((args: {
        ids: string[];
        resourceType: "product" | "product_category" | "product_collection";
      }) => Promise<Map<string, CatalogNameTranslation>>)
    | undefined;
}): Promise<Array<T & { translation: CatalogNameTranslation }>> {
  if (!input.items.length || !input.summarizeNames) {
    return input.items.map((item) => ({
      ...item,
      translation: emptyTranslation(),
    }));
  }

  const summaries = await input.summarizeNames({
    ids: input.items.map((item) => item.id),
    resourceType: input.resourceType,
  });

  return input.items.map((item) => ({
    ...item,
    translation: summaries.get(item.id) ?? emptyTranslation(),
  }));
}
