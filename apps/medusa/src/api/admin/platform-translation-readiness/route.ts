import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { IProductModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import { toProductTranslationReadiness, toShippingOptionTranslationReadiness, toTaxonomyTranslationReadiness } from "../../../lib/catalog-translation-readiness";
import { tenantTaxonomyFilters } from "../../../lib/tenant-taxonomy-query";

type ReadinessQuery = {
  locale: "am-ET";
  limit: number;
  offset: number;
  q?: string;
  resource_type: "product" | "product_category" | "product_collection" | "shipping_option";
  shipping_option_id?: string;
  status?: "using_english" | "needs_review" | "ready";
  tenant_id: string;
};

type ReadinessItem = ReturnType<typeof toProductTranslationReadiness>;
type GraphQuery = { graph(input: { entity: string; fields: string[]; filters: Record<string, unknown>; pagination: { skip: number; take: number } }): Promise<{ data: Array<Record<string, unknown> & { id: string }> }> };

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const input = req.validatedQuery as ReadinessQuery;
  const query = req.scope.resolve<GraphQuery>("query");
  const items = input.resource_type === "product"
    ? await productReadiness(req, query, input)
    : input.resource_type === "shipping_option"
      ? await shippingReadiness(query, input)
      : await taxonomyReadiness(req, query, input);
  const counts = { ready: 0, needs_review: 0, using_english: 0 };
  for (const item of items) counts[item.status] += 1;
  const ordered = input.status
    ? items.filter((item) => item.status === input.status)
    : [
        ...items.filter((item) => item.status === "using_english"),
        ...items.filter((item) => item.status === "needs_review"),
        ...items.filter((item) => item.status === "ready"),
      ];
  return res.json({
    items: ordered.slice(input.offset, input.offset + input.limit),
    count: ordered.length,
    ready: counts.ready,
    needsReview: counts.needs_review,
    usingEnglish: counts.using_english,
    limit: input.limit,
    offset: input.offset,
  });
}

async function shippingReadiness(query: GraphQuery, input: ReadinessQuery) {
  if (!input.shipping_option_id) return [];
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "translations.locale_code", "translations.translations"],
    filters: { id: input.shipping_option_id },
    pagination: { skip: 0, take: 1 },
  });
  return data.map((resource) => toShippingOptionTranslationReadiness(resource, input.locale));
}

async function productReadiness(req: AuthenticatedMedusaRequest, query: GraphQuery, input: ReadinessQuery) {
  const salesChannelId = Array.isArray(req.filterableFields.sales_channel_id)
    ? req.filterableFields.sales_channel_id[0]
    : req.filterableFields.sales_channel_id;
  const result: ReadinessItem[] = [];
  const take = 100;
  for (let skip = 0; ; skip += take) {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id", "title", "subtitle", "description", "material",
        "translations.locale_code", "translations.translations",
        "options.id", "options.title", "options.translations.locale_code", "options.translations.translations",
        "options.values.id", "options.values.value", "options.values.translations.locale_code", "options.values.translations.translations",
        "variants.id", "variants.title", "variants.material", "variants.translations.locale_code", "variants.translations.translations",
      ],
      filters: { sales_channels: { id: salesChannelId }, ...(input.q ? { q: input.q } : {}) },
      pagination: { skip, take },
    });
    result.push(...data.map((product) => toProductTranslationReadiness(product, input.locale)));
    if (data.length < take) break;
  }
  return result;
}

async function taxonomyReadiness(req: AuthenticatedMedusaRequest, query: GraphQuery, input: ReadinessQuery) {
  const products = req.scope.resolve<IProductModuleService>(Modules.PRODUCT);
  const resourceType = input.resource_type === "product_category" ? "product_category" : "product_collection";
  const kind = resourceType === "product_category" ? "categories" : "collections";
  const filters = tenantTaxonomyFilters({
    kind,
    limit: 100,
    offset: 0,
    tenant_id: input.tenant_id,
    ...(input.q ? { q: input.q } : {}),
  });
  const ids: string[] = [];
  const take = 100;
  for (let skip = 0; ; skip += take) {
    const [resources] = kind === "categories"
      ? await products.listAndCountProductCategories(
          filters as Parameters<IProductModuleService["listAndCountProductCategories"]>[0],
          { select: ["id"], skip, take },
        )
      : await products.listAndCountProductCollections(
          filters as Parameters<IProductModuleService["listAndCountProductCollections"]>[0],
          { select: ["id"], skip, take },
        );
    ids.push(...resources.map((resource) => resource.id));
    if (resources.length < take) break;
  }
  if (!ids.length) return [];
  const result: ReadinessItem[] = [];
  for (let offset = 0; offset < ids.length; offset += take) {
    const { data } = await query.graph({
      entity: resourceType,
      fields: resourceType === "product_category"
        ? ["id", "name", "description", "translations.locale_code", "translations.translations"]
        : ["id", "title", "translations.locale_code", "translations.translations"],
      filters: { id: ids.slice(offset, offset + take) },
      pagination: { skip: 0, take },
    });
    result.push(...data.map((resource) => toTaxonomyTranslationReadiness(resource, input.locale, resourceType)));
  }
  return result;
}
