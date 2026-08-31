import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  exportProductsToCsv,
  productExportFilename,
} from "../../modules/data-transfer/product-export.js";
import {
  dryRunProductImport,
  loadExistingProductsForImport,
  MAX_PRODUCT_IMPORT_BYTES,
} from "../../modules/data-transfer/product-import-dry-run.js";
import { buildProductImportWritePlan } from "../../modules/data-transfer/product-import-plan.js";
import {
  applyBulkInventoryUpdates,
  parseBulkInventoryUpdates,
} from "../../modules/inventory/bulk-adjustment.js";
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

  app.get("/platform/merchant/products/export.csv", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;

    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.listMerchantProducts) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const result = await exportProductsToCsv({
      listProducts: options.listMerchantProducts,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: merchant.result.context.medusaStockLocationId,
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status as ContentfulStatusCode);
    }

    return new Response(result.csv, {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${productExportFilename()}"`,
        "content-type": "text/csv; charset=utf-8",
        "x-ecs-export-products": String(result.productCount),
        "x-ecs-export-rows": String(result.rowCount),
      },
    });
  });

  app.post("/platform/merchant/products/inventory/batch", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context, {
      requireStockLocation: true,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.updateMerchantProductVariantStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const parsed = parseBulkInventoryUpdates(body.updates);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const stockLocationId = commerce.context.medusaStockLocationId;
    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const result = await applyBulkInventoryUpdates({
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
      updates: parsed.updates,
      updateStock: options.updateMerchantProductVariantStock,
    });
    return context.json(result);
  });

  app.post("/platform/merchant/products/import/dry-run", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.listMerchantProducts) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const declaredLength = Number(context.req.header("content-length") ?? 0);
    if (declaredLength > MAX_PRODUCT_IMPORT_BYTES) {
      return context.json({ error: "product_import_file_too_large" }, 413);
    }
    const csv = await context.req.text();
    if (new TextEncoder().encode(csv).byteLength > MAX_PRODUCT_IMPORT_BYTES) {
      return context.json({ error: "product_import_file_too_large" }, 413);
    }
    const existing = await loadExistingProductsForImport({
      listProducts: options.listMerchantProducts,
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!existing.ok) {
      return context.json({ error: existing.error }, existing.status as ContentfulStatusCode);
    }
    const dryRun = dryRunProductImport({ csv, existingProducts: existing.products });
    const writePlan = buildProductImportWritePlan({ csv, existingProducts: existing.products });
    if (!writePlan.ok || !options.createReviewedProductImportArtifact) {
      return context.json(dryRun);
    }
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const artifact = await options.createReviewedProductImportArtifact({
      csv,
      dryRun,
      tenantId: merchant.result.context.tenantId,
      userId: session.user.id,
      writes: writePlan.writes,
    });
    return context.json({ ...dryRun, artifact });
  });

  app.post("/platform/merchant/products/import/apply", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    if (!options.requestProductImportApply) {
      return context.json({ error: "product_import_queue_unavailable" }, 503);
    }
    const body = await getJsonBody(context.req.raw);
    const artifactId = getRequiredBodyString(body, "artifactId");
    const contentDigest = getRequiredBodyString(body, "contentDigest");
    const idempotencyKey = getRequiredBodyString(body, "idempotencyKey");
    if (!artifactId || !contentDigest || !idempotencyKey) {
      return context.json({ error: "product_import_apply_invalid" }, 400);
    }
    const result = await options.requestProductImportApply({
      artifactId,
      contentDigest,
      idempotencyKey,
      tenantId: merchant.result.context.tenantId,
      userId: session.user.id,
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status as ContentfulStatusCode);
    }
    return context.json(result, 202);
  });

  app.get("/platform/merchant/products/import/executions/:executionId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.getProductImportExecution) {
      return context.json({ error: "product_import_queue_unavailable" }, 503);
    }
    const result = await options.getProductImportExecution({
      executionId: context.req.param("executionId"),
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
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
    const productOptions = getOptionalBodyProductOptions(body);
    const product = await options.updateMerchantProduct({
      productId: context.req.param("productId"),
      title: getOptionalBodyString(body, "title"),
      description: getOptionalBodyString(body, "description"),
      handle: getOptionalBodyString(body, "handle"),
      collectionId: getOptionalBodyString(body, "collectionId"),
      categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
      imageUrls: getOptionalBodyStringArray(body, "imageUrls"),
      ...(productOptions ? { options: productOptions } : {}),
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
