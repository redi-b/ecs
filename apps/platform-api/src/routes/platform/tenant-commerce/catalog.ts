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
    });

    if (!category.ok) {
      return context.json({ error: category.error }, category.status);
    }

    return context.json({
      category: category.category,
    });
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
