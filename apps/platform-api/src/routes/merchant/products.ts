import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getJsonBody,
  getOptionalBodyNumber,
  getOptionalBodyString,
  getOptionalBodyStringArray,
  getPaginationValue,
  getRequestHost,
  getRequiredBodyString,
  storeErrorStatus,
} from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";
import { getOptionalBodyProductOptions, getOptionalBodyProductVariants } from "./product-body.js";

export function registerMerchantProductRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext, getResolvedCommerce } = helpers;

  app.post("/platform/merchant/products", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context, {
      requireRegion: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.createMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");
    const productOptions = getOptionalBodyProductOptions(body);
    const productVariants = getOptionalBodyProductVariants(body);

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
      ...(productVariants ? { variants: productVariants } : {}),
      priceAmount: getOptionalBodyNumber(body, "priceAmount"),
      currencyCode: getOptionalBodyString(body, "currencyCode") ?? "etb",
      regionId: commerce.context.medusaRegionId,
      status: getOptionalBodyString(body, "status"),
      ...(result.context.medusaStockLocationId
        ? { stockLocationId: result.context.medusaStockLocationId }
        : {}),
      ...(result.context.medusaShippingProfileId
        ? { shippingProfileId: result.context.medusaShippingProfileId }
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

  app.get("/platform/merchant/products", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.listMerchantProducts) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const products = await options.listMerchantProducts({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: result.context.medusaStockLocationId,
      ...(context.req.query("q")?.trim() ? { q: context.req.query("q")!.trim() } : {}),
      ...(context.req.query("status")?.trim()
        ? { status: context.req.query("status")!.trim() }
        : {}),
      ...(context.req.query("collectionId")?.trim()
        ? { collectionId: context.req.query("collectionId")!.trim() }
        : {}),
      ...(context.req.query("categoryId")?.trim()
        ? { categoryId: context.req.query("categoryId")!.trim() }
        : {}),
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

  app.get("/platform/merchant/products/:productId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const commerce = getResolvedCommerce(merchant.result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.getMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
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

  app.get("/platform/merchant/products/:productId/stock", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context, {
      requireStockLocation: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.getMerchantProductStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const stock = await options.getMerchantProductStock({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.post("/platform/merchant/products/:productId/stock", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context, {
      requireStockLocation: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.updateMerchantProductStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");

    if (stockedQuantity === undefined || stockedQuantity < 0) {
      return context.json({ error: "invalid_stocked_quantity" }, 400);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const productId = context.req.param("productId");
    const stock = await options.updateMerchantProductStock({
      productId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
      stockedQuantity,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.get("/platform/merchant/products/:productId/variants/:variantId/stock", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context, {
      requireStockLocation: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.getMerchantProductVariantStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const stock = await options.getMerchantProductVariantStock({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
      variantId: context.req.param("variantId"),
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.post("/platform/merchant/products/:productId/variants/:variantId/stock", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context, {
      requireStockLocation: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.updateMerchantProductVariantStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");

    if (
      stockedQuantity === undefined ||
      stockedQuantity < 0 ||
      !Number.isInteger(stockedQuantity)
    ) {
      return context.json({ error: "invalid_stocked_quantity" }, 400);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const productId = context.req.param("productId");
    const variantId = context.req.param("variantId");
    const stock = await options.updateMerchantProductVariantStock({
      productId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
      stockedQuantity,
      variantId,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.post("/platform/merchant/products/batch-delete", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductsBatch)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

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

  app.post("/platform/merchant/products/:productId", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.updateMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
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

  app.delete("/platform/merchant/products/:productId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProduct)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const result = await options.deleteMerchantProduct({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });
}
