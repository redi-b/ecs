import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../../app.js";
import {
  getJsonBody,
  getOptionalBodyString,
  getOptionalBodyStringArray,
  getPaginationValue,
  getRequiredBodyString,
} from "../../shared.js";

export function registerPlatformTenantCatalogRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.get("/platform/tenants/:tenantId/product-categories", async (context) => {
    if (!options.getTenantCommerceContext || !options.listMerchantProductCategories) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const categories = await options.listMerchantProductCategories({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      tenantId: commerce.context.tenantId,
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

  app.post("/platform/tenants/:tenantId/product-categories", async (context) => {
    if (!options.getTenantCommerceContext || !options.createMerchantProductCategory) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    const category = await options.createMerchantProductCategory({
      name,
      handle: getOptionalBodyString(body, "handle"),
      tenantId: commerce.context.tenantId,
      ...(getOptionalBodyString(body, "parentCategoryId")
        ? { parentCategoryId: getOptionalBodyString(body, "parentCategoryId") }
        : {}),
      ...(getOptionalBodyString(body, "visibility")
        ? {
            visibility:
              getOptionalBodyString(body, "visibility") === "hidden" ? "hidden" : "public",
          }
        : {}),
    });

    if (!category.ok) {
      return context.json({ error: category.error }, category.status);
    }

    return context.json({
      category: category.category,
    });
  });

  app.post("/platform/tenants/:tenantId/product-categories/reorder", async (context) => {
    if (!options.getTenantCommerceContext || !options.reorderMerchantProductCategories) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

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
      tenantId: commerce.context.tenantId,
    });
    return result.ok
      ? context.json({ ok: true })
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/tenants/:tenantId/product-categories/:categoryId", async (context) => {
    if (!options.getTenantCommerceContext || !options.updateMerchantProductCategory) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    if (!name) return context.json({ error: "missing_name" }, 400);

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
      name,
      parentCategoryId: getOptionalBodyString(body, "parentCategoryId"),
      ...(rank === undefined ? {} : { rank }),
      tenantId: commerce.context.tenantId,
      visibility: getOptionalBodyString(body, "visibility") === "hidden" ? "hidden" : "public",
    });

    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/tenants/:tenantId/product-collections", async (context) => {
    if (!options.getTenantCommerceContext || !options.listMerchantProductCollections) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const collections = await options.listMerchantProductCollections({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      tenantId: commerce.context.tenantId,
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

  app.post("/platform/tenants/:tenantId/product-collections", async (context) => {
    if (!options.getTenantCommerceContext || !options.createMerchantProductCollection) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const collection = await options.createMerchantProductCollection({
      title,
      handle: getOptionalBodyString(body, "handle"),
      tenantId: commerce.context.tenantId,
    });

    if (!collection.ok) {
      return context.json({ error: collection.error }, collection.status);
    }

    return context.json({
      collection: collection.collection,
    });
  });

  app.delete("/platform/tenants/:tenantId/product-categories/:categoryId", async (context) => {
    if (!options.getTenantCommerceContext || !options.deleteMerchantProductCategory) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const result = await options.deleteMerchantProductCategory({
      categoryId: context.req.param("categoryId"),
      tenantId: context.req.param("tenantId"),
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/tenants/:tenantId/product-categories/batch-delete", async (context) => {
    if (!options.getTenantCommerceContext || !options.deleteMerchantProductCategoriesBatch) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const body = await getJsonBody(context.req.raw);
    const categoryIds = getOptionalBodyStringArray(body, "categoryIds");
    if (!categoryIds || categoryIds.length === 0)
      return context.json({ error: "invalid_category_ids" }, 400);

    const result = await options.deleteMerchantProductCategoriesBatch({
      categoryIds,
      tenantId: context.req.param("tenantId"),
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/tenants/:tenantId/product-collections/:collectionId", async (context) => {
    if (!options.getTenantCommerceContext || !options.updateMerchantProductCollection) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");
    if (!title) return context.json({ error: "missing_title" }, 400);

    const result = await options.updateMerchantProductCollection({
      collectionId: context.req.param("collectionId"),
      handle: getOptionalBodyString(body, "handle"),
      mediaUrl: getOptionalBodyString(body, "mediaUrl"),
      seoDescription: getOptionalBodyString(body, "seoDescription"),
      seoTitle: getOptionalBodyString(body, "seoTitle"),
      tenantId: commerce.context.tenantId,
      title,
      visibility: getOptionalBodyString(body, "visibility") === "hidden" ? "hidden" : "public",
    });

    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, result.status);
  });

  app.delete("/platform/tenants/:tenantId/product-collections/:collectionId", async (context) => {
    if (!options.getTenantCommerceContext || !options.deleteMerchantProductCollection) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const result = await options.deleteMerchantProductCollection({
      collectionId: context.req.param("collectionId"),
      tenantId: context.req.param("tenantId"),
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/tenants/:tenantId/product-collections/batch-delete", async (context) => {
    if (!options.getTenantCommerceContext || !options.deleteMerchantProductCollectionsBatch) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const body = await getJsonBody(context.req.raw);
    const collectionIds = getOptionalBodyStringArray(body, "collectionIds");
    if (!collectionIds || collectionIds.length === 0)
      return context.json({ error: "invalid_collection_ids" }, 400);

    const result = await options.deleteMerchantProductCollectionsBatch({
      collectionIds,
      tenantId: context.req.param("tenantId"),
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });
}
