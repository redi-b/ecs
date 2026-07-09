import type { Context, Hono } from "hono";
import type { MerchantOrderAction, PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getJsonBody,
  getOptionalBodyNumber,
  getOptionalBodyString,
  getOptionalBodyStringArray,
  getPaginationValue,
  getRequiredBodyString,
} from "../shared.js";
import {
  getOptionalBodyProductOptions,
  getOptionalBodyProductVariants,
} from "../merchant/product-body.js";

export function registerPlatformTenantCommerceRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {

  app.get("/platform/tenants/:tenantId/orders", async (context) => {
    if (!options.getTenantCommerceContext || !options.listMerchantOrders) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");

    if (!tenantId) {
      return context.json({ error: "tenant_not_found" }, 404);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId,
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const orders = await options.listMerchantOrders({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!orders.ok) {
      return context.json({ error: orders.error }, orders.status);
    }

    return context.json({
      orders: orders.orders,
      count: orders.count,
      limit: orders.limit,
      offset: orders.offset,
    });
  });

  app.get("/platform/tenants/:tenantId/orders/:orderId", async (context) => {
    if (!options.getTenantCommerceContext || !options.getMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const orderId = context.req.param("orderId");

    if (!tenantId || !orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId,
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const order = await options.getMerchantOrder({
      orderId: context.req.param("orderId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
    }

    return context.json({
      order: order.order,
    });
  });

  async function mutateSelectedTenantOrder(
    context: Context<{ Variables: PlatformAppVariables }>,
    action: MerchantOrderAction,
  ) {
    if (!options.getTenantCommerceContext || !options.mutateMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const orderId = context.req.param("orderId");
    const fulfillmentId = context.req.param("fulfillmentId");

    if (!tenantId || !orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    if (action === "deliver" && !fulfillmentId) {
      return context.json({ error: "order_fulfillment_not_found" }, 404);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId,
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (action === "fulfill" && !commerce.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const order = await options.mutateMerchantOrder({
      action,
      ...(action === "deliver" ? { fulfillmentId } : {}),
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      ...(action === "fulfill"
        ? { stockLocationId: commerce.context.medusaStockLocationId ?? undefined }
        : {}),
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
    }

    return context.json({
      order: order.order,
    });
  }

  app.post("/platform/tenants/:tenantId/orders/:orderId/cancel", (context) =>
    mutateSelectedTenantOrder(context, "cancel"),
  );

  app.post("/platform/tenants/:tenantId/orders/:orderId/complete", (context) =>
    mutateSelectedTenantOrder(context, "complete"),
  );

  app.post("/platform/tenants/:tenantId/orders/:orderId/fulfill", (context) =>
    mutateSelectedTenantOrder(context, "fulfill"),
  );

  app.post(
    "/platform/tenants/:tenantId/orders/:orderId/fulfillments/:fulfillmentId/deliver",
    (context) => mutateSelectedTenantOrder(context, "deliver"),
  );

  app.get("/platform/tenants/:tenantId/products", async (context) => {
    if (!options.getTenantCommerceContext || !options.listMerchantProducts) {
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

    const products = await options.listMerchantProducts({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId,
    });

    if (!products.ok) {
      return context.json({ error: products.error }, products.status);
    }

    return context.json({
      products: products.products,
      count: products.count,
      limit: products.limit,
      offset: products.offset,
    });
  });

  app.get("/platform/tenants/:tenantId/products/:productId", async (context) => {
    if (!options.getTenantCommerceContext || !options.getMerchantProduct) {
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

    const product = await options.getMerchantProduct({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.get("/platform/tenants/:tenantId/products/:productId/stock", async (context) => {
    if (!options.getTenantCommerceContext || !options.getMerchantProductStock) {
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

    if (!commerce.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const stock = await options.getMerchantProductStock({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.post("/platform/tenants/:tenantId/products/:productId/stock", async (context) => {
    if (!options.getTenantCommerceContext || !options.updateMerchantProductStock) {
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

    if (!commerce.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");

    if (stockedQuantity === undefined || stockedQuantity < 0) {
      return context.json({ error: "invalid_stocked_quantity" }, 400);
    }

    const stock = await options.updateMerchantProductStock({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId,
      stockedQuantity,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

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

  app.get("/platform/tenants/:tenantId/dashboard", async (context) => {
    if (!options.getTenantDashboardSummary) {
      return context.json({ error: "dashboard_summary_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.getTenantDashboardSummary({ tenantId });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      ...result.summary,
      actor: authorization.actor,
    });
  });

  app.post("/platform/tenants/:tenantId/settings", async (context) => {
    if (!options.updateTenantShopSettings) {
      return context.json({ error: "settings_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    const handle = getRequiredBodyString(body, "handle");

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    if (!handle) {
      return context.json({ error: "missing_handle" }, 400);
    }

    const result = await options.updateTenantShopSettings({
      handle,
      name,
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      tenant: result.tenant,
    });
  });

  app.post("/platform/tenants/:tenantId/products", async (context) => {
    if (!options.getTenantCommerceContext || !options.createMerchantProduct) {
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
    const productOptions = getOptionalBodyProductOptions(body);

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const product = await options.createMerchantProduct({
      title,
      description: getOptionalBodyString(body, "description"),
      handle: getOptionalBodyString(body, "handle"),
      collectionId: getOptionalBodyString(body, "collectionId"),
      categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
      imageUrls: getOptionalBodyStringArray(body, "imageUrls"),
      ...(productOptions ? { options: productOptions } : {}),
      priceAmount: getOptionalBodyNumber(body, "priceAmount"),
      currencyCode: getOptionalBodyString(body, "currencyCode") ?? "etb",
      regionId: commerce.context.medusaRegionId,
      status: getOptionalBodyString(body, "status"),
      ...(commerce.context.medusaStockLocationId
        ? { stockLocationId: commerce.context.medusaStockLocationId }
        : {}),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.post("/platform/tenants/:tenantId/products/batch-delete", async (context) => {
    if (!options.getTenantCommerceContext || !options.deleteMerchantProductsBatch) {
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
    const productIds = getOptionalBodyStringArray(body, "productIds");
    if (!productIds || productIds.length === 0)
      return context.json({ error: "invalid_product_ids" }, 400);

    const result = await options.deleteMerchantProductsBatch({
      productIds,
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/tenants/:tenantId/products/:productId", async (context) => {
    if (!options.getTenantCommerceContext || !options.updateMerchantProduct) {
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
    const product = await options.updateMerchantProduct({
      productId: context.req.param("productId"),
      title: getOptionalBodyString(body, "title"),
      description: getOptionalBodyString(body, "description"),
      handle: getOptionalBodyString(body, "handle"),
      collectionId: getOptionalBodyString(body, "collectionId"),
      categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
      imageUrls: getOptionalBodyStringArray(body, "imageUrls"),
      status: getOptionalBodyString(body, "status"),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.delete("/platform/tenants/:tenantId/products/:productId", async (context) => {
    if (!options.getTenantCommerceContext || !options.deleteMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const commerce = await options.getTenantCommerceContext({
      tenantId: context.req.param("tenantId"),
      userId: session.user.id,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const result = await options.deleteMerchantProduct({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
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
