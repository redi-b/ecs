import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getJsonBody,
  getOptionalBodyString,
  getOptionalBodyStringArray,
  getPaginationValue,
  getRequiredBodyString,
} from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

export function registerMerchantCatalogRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext, getResolvedCommerce } = helpers;

  app.get("/platform/merchant/product-categories", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.listMerchantProductCategories) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const categories = await options.listMerchantProductCategories({
      limit: getPaginationValue(context.req.query("limit"), 100, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      tenantId: merchant.result.context.tenantId,
      ...(context.req.query("q")?.trim() ? { q: context.req.query("q")!.trim() } : {}),
    });

    if (!categories.ok) {
      return context.json({ error: categories.error }, categories.status);
    }

    return context.json({
      categories: categories.categories,
      count: categories.count,
      limit: categories.limit,
      offset: categories.offset,
    });
  });

  app.post("/platform/merchant/product-categories", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.createMerchantProductCategory) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    const category = await options.createMerchantProductCategory({
      name,
      handle: getOptionalBodyString(body, "handle"),
      tenantId: merchant.result.context.tenantId,
      ...(getOptionalBodyString(body, "parentCategoryId")
        ? { parentCategoryId: getOptionalBodyString(body, "parentCategoryId") }
        : {}),
      ...(getOptionalBodyString(body, "visibility")
        ? {
            visibility:
              getOptionalBodyString(body, "visibility") === "hidden" ? "hidden" : "public",
          }
        : {}),
      ...(getOptionalBodyString(body, "seoTitle")
        ? { seoTitle: getOptionalBodyString(body, "seoTitle") }
        : {}),
      ...(getOptionalBodyString(body, "seoDescription")
        ? { seoDescription: getOptionalBodyString(body, "seoDescription") }
        : {}),
      ...(getOptionalBodyString(body, "mediaUrl")
        ? { mediaUrl: getOptionalBodyString(body, "mediaUrl") }
        : {}),
    });

    if (!category.ok) {
      return context.json({ error: category.error }, category.status);
    }

    return context.json({
      category: category.category,
    });
  });

  app.get("/platform/merchant/product-collections", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.listMerchantProductCollections) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const collections = await options.listMerchantProductCollections({
      limit: getPaginationValue(context.req.query("limit"), 100, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      tenantId: merchant.result.context.tenantId,
      ...(context.req.query("q")?.trim() ? { q: context.req.query("q")!.trim() } : {}),
    });

    if (!collections.ok) {
      return context.json({ error: collections.error }, collections.status);
    }

    return context.json({
      collections: collections.collections,
      count: collections.count,
      limit: collections.limit,
      offset: collections.offset,
    });
  });

  app.post("/platform/merchant/product-collections", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.createMerchantProductCollection) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const collection = await options.createMerchantProductCollection({
      title,
      handle: getOptionalBodyString(body, "handle"),
      tenantId: merchant.result.context.tenantId,
      ...(getOptionalBodyString(body, "visibility")
        ? {
            visibility:
              getOptionalBodyString(body, "visibility") === "hidden" ? "hidden" : "public",
          }
        : {}),
      ...(getOptionalBodyString(body, "seoTitle")
        ? { seoTitle: getOptionalBodyString(body, "seoTitle") }
        : {}),
      ...(getOptionalBodyString(body, "seoDescription")
        ? { seoDescription: getOptionalBodyString(body, "seoDescription") }
        : {}),
      ...(getOptionalBodyString(body, "mediaUrl")
        ? { mediaUrl: getOptionalBodyString(body, "mediaUrl") }
        : {}),
    });

    if (!collection.ok) {
      return context.json({ error: collection.error }, collection.status);
    }

    return context.json({
      collection: collection.collection,
    });
  });

  app.post("/platform/merchant/product-categories/reorder", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.reorderMerchantProductCategories) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const body = await getJsonBody(context.req.raw);
    const itemsRaw = body && typeof body === "object" ? (body as { items?: unknown }).items : null;
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      return context.json({ error: "invalid_reorder_items" }, 400);
    }
    const items: Array<{ categoryId: string; rank: number }> = [];
    for (const entry of itemsRaw) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as { categoryId?: unknown; rank?: unknown };
      const categoryId =
        typeof record.categoryId === "string" && record.categoryId.trim()
          ? record.categoryId.trim()
          : null;
      const rank =
        typeof record.rank === "number" && Number.isFinite(record.rank)
          ? Math.max(0, Math.floor(record.rank))
          : null;
      if (!categoryId || rank === null) continue;
      items.push({ categoryId, rank });
    }
    if (!items.length) return context.json({ error: "invalid_reorder_items" }, 400);
    const result = await options.reorderMerchantProductCategories({
      items,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json({ ok: true })
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/product-categories/:categoryId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    if (!name) return context.json({ error: "missing_name" }, 400);
    if (!options.updateMerchantProductCategory)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const rankRaw = body && typeof body === "object" ? (body as { rank?: unknown }).rank : undefined;
    const rank =
      typeof rankRaw === "number" && Number.isFinite(rankRaw)
        ? Math.max(0, Math.floor(rankRaw))
        : typeof rankRaw === "string" && rankRaw.trim() && Number.isFinite(Number(rankRaw))
          ? Math.max(0, Math.floor(Number(rankRaw)))
          : undefined;
    const result = await options.updateMerchantProductCategory({
      categoryId: context.req.param("categoryId"),
      handle: getOptionalBodyString(body, "handle"),
      mediaUrl: getOptionalBodyString(body, "mediaUrl"),
      name,
      parentCategoryId: getOptionalBodyString(body, "parentCategoryId"),
      ...(rank === undefined ? {} : { rank }),
      seoDescription: getOptionalBodyString(body, "seoDescription"),
      seoTitle: getOptionalBodyString(body, "seoTitle"),
      tenantId: merchant.result.context.tenantId,
      visibility: getOptionalBodyString(body, "visibility") === "hidden" ? "hidden" : "public",
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/product-collections/:collectionId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");
    if (!title) return context.json({ error: "missing_title" }, 400);
    if (!options.updateMerchantProductCollection)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.updateMerchantProductCollection({
      collectionId: context.req.param("collectionId"),
      handle: getOptionalBodyString(body, "handle"),
      mediaUrl: getOptionalBodyString(body, "mediaUrl"),
      seoDescription: getOptionalBodyString(body, "seoDescription"),
      seoTitle: getOptionalBodyString(body, "seoTitle"),
      tenantId: merchant.result.context.tenantId,
      title,
      visibility: getOptionalBodyString(body, "visibility") === "hidden" ? "hidden" : "public",
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/merchant/product-collections/:collectionId/products", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.listMerchantCollectionProducts)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.listMerchantCollectionProducts({
      collectionId: context.req.param("collectionId"),
      limit: getPaginationValue(context.req.query("limit"), 50, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: commerce.context.medusaSalesChannelId,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/product-collections/:collectionId/products", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.updateMerchantCollectionProducts)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const body = await getJsonBody(context.req.raw);
    const add = getOptionalBodyStringArray(body, "add") ?? [];
    const remove = getOptionalBodyStringArray(body, "remove") ?? [];
    const result = await options.updateMerchantCollectionProducts({
      add,
      collectionId: context.req.param("collectionId"),
      remove,
      salesChannelId: commerce.context.medusaSalesChannelId,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json({ ok: true })
      : context.json({ error: result.error }, result.status);
  });

  app.delete("/platform/merchant/product-categories/:categoryId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCategory)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const result = await options.deleteMerchantProductCategory({
      categoryId: context.req.param("categoryId"),
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/merchant/product-categories/batch-delete", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCategoriesBatch)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const body = await getJsonBody(context.req.raw);
    const categoryIds = getOptionalBodyStringArray(body, "categoryIds");
    if (!categoryIds || categoryIds.length === 0)
      return context.json({ error: "invalid_category_ids" }, 400);

    const result = await options.deleteMerchantProductCategoriesBatch({
      categoryIds,
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.delete("/platform/merchant/product-collections/:collectionId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCollection)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const result = await options.deleteMerchantProductCollection({
      collectionId: context.req.param("collectionId"),
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/merchant/product-collections/batch-delete", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCollectionsBatch)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const body = await getJsonBody(context.req.raw);
    const collectionIds = getOptionalBodyStringArray(body, "collectionIds");
    if (!collectionIds || collectionIds.length === 0)
      return context.json({ error: "invalid_collection_ids" }, 400);

    const result = await options.deleteMerchantProductCollectionsBatch({
      collectionIds,
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });
}
