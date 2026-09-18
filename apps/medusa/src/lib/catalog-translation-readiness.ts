import { z } from "@medusajs/framework/zod";

export const catalogTranslationReadinessQuerySchema = z.object({
  sales_channel_id: z.preprocess(
    (value) => (Array.isArray(value) ? value : value == null ? value : [value]),
    z.array(z.string().trim().min(1)).length(1),
  ),
  tenant_id: z.string().trim().min(1).max(255),
  locale: z.literal("am-ET"),
  resource_type: z
    .enum(["product", "product_category", "product_collection", "shipping_option"])
    .default("product"),
  shipping_option_id: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  status: z.enum(["using_english", "needs_review", "ready"]).optional(),
  q: z.string().trim().max(120).optional(),
});

export const CATALOG_SOURCE_HASH_FIELD = "__ecs_source_hash";
export const PRODUCT_TRANSLATION_FIELDS = ["title", "subtitle", "description", "material"] as const;
const PRODUCT_OPTION_TRANSLATION_FIELDS = ["title"] as const;
const PRODUCT_OPTION_VALUE_TRANSLATION_FIELDS = ["value"] as const;
export const PRODUCT_CATEGORY_TRANSLATION_FIELDS = ["name", "description"] as const;
export const PRODUCT_COLLECTION_TRANSLATION_FIELDS = ["title"] as const;
export const SHIPPING_OPTION_TRANSLATION_FIELDS = ["name"] as const;

type TranslationEntry = {
  locale_code?: string | null;
  translations?: Record<string, unknown> | null;
};

type NestedTranslationSource = Record<string, unknown> & {
  id?: string | null;
  translations?: TranslationEntry[] | null;
};

type ProductTranslationSource = Record<string, unknown> & {
  id: string;
  title?: string | null;
  translations?: TranslationEntry[] | null;
  options?: Array<NestedTranslationSource & { values?: NestedTranslationSource[] | null }> | null;
  variants?: NestedTranslationSource[] | null;
};

function sourceValues(resource: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(
    fields
      .map(
        (field) =>
          [field, typeof resource[field] === "string" ? resource[field].trim() : ""] as const,
      )
      .filter(([, value]) => value.length > 0),
  );
}

function resourceReadiness(
  resource: NestedTranslationSource,
  locale: string,
  fields: readonly string[],
) {
  const source = sourceValues(resource, fields);
  const stored =
    resource.translations?.find((item) => item.locale_code === locale)?.translations ?? {};
  const fieldNames = Object.keys(source);
  const translatedFields = fieldNames.filter(
    (field) => typeof stored[field] === "string" && stored[field].trim().length > 0,
  ).length;
  return {
    translatedFields,
    totalFields: fieldNames.length,
    current: fieldNames.length > 0 && translatedFields === fieldNames.length,
  };
}

export function toProductTranslationReadiness(product: ProductTranslationSource, locale: string) {
  const options = product.options ?? [];
  const variants = product.variants ?? [];
  const syntheticDefault =
    options.length === 1 &&
    variants.length === 1 &&
    isDefaultName(options[0]?.title) &&
    (options[0]?.values ?? []).every((value) => isDefaultName(value.value));
  const resources = [
    resourceReadiness(product, locale, PRODUCT_TRANSLATION_FIELDS),
    ...(syntheticDefault ? [] : options).flatMap((option) => [
      resourceReadiness(option, locale, PRODUCT_OPTION_TRANSLATION_FIELDS),
      ...(option.values ?? []).map((value) =>
        resourceReadiness(value, locale, PRODUCT_OPTION_VALUE_TRANSLATION_FIELDS),
      ),
    ]),
  ].filter((resource) => resource.totalFields > 0);
  const translatedFields = resources.reduce(
    (total, resource) => total + resource.translatedFields,
    0,
  );
  const totalFields = resources.reduce((total, resource) => total + resource.totalFields, 0);
  const status =
    translatedFields === 0
      ? "using_english"
      : translatedFields === totalFields && resources.every((resource) => resource.current)
        ? "ready"
        : "needs_review";
  return {
    resourceId: product.id,
    title: product.title?.trim() || "Product",
    status,
    translatedFields,
    totalFields,
  } as const;
}

function isDefaultName(value: unknown) {
  return typeof value === "string" && value.trim().toLocaleLowerCase().startsWith("default");
}

export function toTaxonomyTranslationReadiness(
  resource: NestedTranslationSource,
  locale: string,
  kind: "product_category" | "product_collection",
) {
  const readiness = resourceReadiness(
    resource,
    locale,
    kind === "product_category"
      ? PRODUCT_CATEGORY_TRANSLATION_FIELDS
      : PRODUCT_COLLECTION_TRANSLATION_FIELDS,
  );
  return {
    resourceId: resource.id ?? "",
    title:
      (typeof resource.name === "string" ? resource.name.trim() : "") ||
      (typeof resource.title === "string" ? resource.title.trim() : "") ||
      (kind === "product_category" ? "Category" : "Collection"),
    status:
      readiness.translatedFields === 0
        ? "using_english"
        : readiness.current
          ? "ready"
          : "needs_review",
    translatedFields: readiness.translatedFields,
    totalFields: readiness.totalFields,
  } as const;
}

export function toShippingOptionTranslationReadiness(
  resource: NestedTranslationSource,
  locale: string,
) {
  const readiness = resourceReadiness(resource, locale, SHIPPING_OPTION_TRANSLATION_FIELDS);
  return {
    resourceId: resource.id ?? "",
    title: (typeof resource.name === "string" ? resource.name.trim() : "") || "Delivery",
    status:
      readiness.translatedFields === 0
        ? "using_english"
        : readiness.current
          ? "ready"
          : "needs_review",
    translatedFields: readiness.translatedFields,
    totalFields: readiness.totalFields,
  } as const;
}
