import type {
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";

export type TaxonomyTableFilterInput = {
  query: string;
};

export function filterCollectionsForTable(
  collections: MerchantProductCollection[],
  input: TaxonomyTableFilterInput,
) {
  const query = input.query.trim().toLowerCase();

  if (!query) {
    return collections;
  }

  return collections.filter((collection) =>
    getTaxonomySearchText([collection.id, collection.title, collection.handle]).includes(query),
  );
}

export function filterCategoriesForTable(
  categories: MerchantProductCategory[],
  input: TaxonomyTableFilterInput,
) {
  const query = input.query.trim().toLowerCase();

  if (!query) {
    return categories;
  }

  return categories.filter((category) =>
    getTaxonomySearchText([
      category.id,
      category.name,
      category.handle,
      category.parentCategoryId,
    ]).includes(query),
  );
}

export function getTaxonomyTableCounts(input: {
  filteredCount: number;
  pageCount: number;
  query: string;
  totalCount: number;
}) {
  const { query, ...counts } = input;

  return {
    ...counts,
    hasActiveFilter: query.trim().length > 0,
  };
}

export function formatTaxonomyDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

export function getCollectionDisplayName(collection: MerchantProductCollection) {
  return getFirstDisplayValue([collection.title, collection.handle, collection.id]);
}

export function getCategoryDisplayName(category: MerchantProductCategory) {
  return getFirstDisplayValue([category.name, category.handle, category.id]);
}

export function slugifyTaxonomyHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTaxonomySearchText(values: Array<string | null>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function getFirstDisplayValue(values: Array<string | null>) {
  return values.map((value) => value?.trim()).find((value) => value) ?? "";
}
