import { type MerchantProduct, merchantInventoryMovementReasonSchema } from "@ecs/contracts";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { productListFiltersSchema } from "../../modules/commerce/product-list-filters.js";
import { runProductWriteCommand } from "../../modules/commerce/product-write-command.js";
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
import { filterProductsByInventory } from "../../modules/inventory/low-stock-products.js";
import { getLowStockThreshold } from "../../modules/notifications/inventory-low.js";
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
import {
  getOptionalBodyOptionMediaBindings,
  getOptionalBodyProductOptions,
  getOptionalBodyProductVariants,
} from "./product-body.js";
import { getProductOptionSetValues } from "./product-option-set-body.js";

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
      permission: { products: ["create"] },
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
    const optionMediaBindings = getOptionalBodyOptionMediaBindings(body);

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const command = await runProductWriteCommand(
      {
        getProduct: options.getMerchantProduct,
        syncProductMedia: options.syncProductMedia,
        write: () =>
          options.createMerchantProduct!({
            title,
            description: getOptionalBodyString(body, "description"),
            handle: getOptionalBodyString(body, "handle"),
            collectionId: getOptionalBodyString(body, "collectionId"),
            categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
            imageUrls: getOptionalBodyStringArray(body, "imageUrls"),
            ...(optionMediaBindings !== undefined ? { optionMediaBindings } : {}),
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
            tenantId: result.context.tenantId,
          }),
      },
      {
        salesChannelId: commerce.context.medusaSalesChannelId,
        synchronizeMedia:
          body !== null &&
          typeof body === "object" &&
          ["imageUrls", "thumbnail", "variants", "options", "optionMediaBindings"].some(
            (key) => key in body,
          ),
        tenantId: result.context.tenantId,
      },
    );
    const product = command.result;

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
      mediaSyncWarning: command.mediaSyncWarning,
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
      permission: { products: ["read"] },
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

    const filters = productListFiltersSchema.safeParse(context.req.query());
    if (!filters.success) return context.json({ error: "invalid_product_filter" }, 400);
    const { inventory, ...catalogFilters } = filters.data;
    const limit = getPaginationValue(context.req.query("limit"), 20, 100);
    const offset = getPaginationValue(context.req.query("offset"), 0, 10_000);
    const products = inventory
      ? await listProductsByInventory({
          filter: inventory,
          filters: catalogFilters,
          listProducts: options.listMerchantProducts,
          limit,
          offset,
          salesChannelId: commerce.context.medusaSalesChannelId,
          stockLocationId: result.context.medusaStockLocationId,
        })
      : await options.listMerchantProducts({
          ...catalogFilters,
          limit,
          offset,
          salesChannelId: commerce.context.medusaSalesChannelId,
          stockLocationId: result.context.medusaStockLocationId,
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
    const merchant = await getAuthorizedMerchantContext(context, { products: ["export"] });
    if (!merchant.ok) return merchant.response;

    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.listMerchantProducts) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const filters = productListFiltersSchema.safeParse(context.req.query());
    if (!filters.success) return context.json({ error: "invalid_product_filter" }, 400);
    const result = await exportProductsToCsv({
      filters: filters.data,
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
    const merchant = await getAuthorizedMerchantContext(context, { products: ["update"] });
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context, {
      requireStockLocation: true,
    });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.updateMerchantProductVariantStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const updateVariantStock = options.updateMerchantProductVariantStock;
    const getVariantStock = options.getMerchantProductVariantStock;
    const appendMovement = options.appendMerchantInventoryMovement;
    if (!getVariantStock || !appendMovement) {
      return context.json({ error: "inventory_movement_ledger_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const parsed = parseBulkInventoryUpdates(body.updates);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const stockLocationId = commerce.context.medusaStockLocationId;
    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);

    const applyUpdates = () =>
      applyBulkInventoryUpdates({
        salesChannelId: commerce.context.medusaSalesChannelId,
        stockLocationId,
        updates: parsed.updates,
        updateStock: async (update) => {
          const before = await getVariantStock(update);
          if (!before.ok) return before;
          if (!before.stock.inventoryItemId) {
            return {
              ok: false as const,
              error: "product_inventory_unavailable",
              status: 409 as const,
            };
          }
          const updated = await updateVariantStock(update);
          if (!updated.ok) return updated;
          await appendMovement({
            actorUserId: merchant.session.user.id,
            delta:
              (updated.stock.stockedQuantity ?? update.stockedQuantity) -
              (before.stock.stockedQuantity ?? 0),
            inventoryItemId: before.stock.inventoryItemId,
            locationId: stockLocationId,
            note: null,
            observedAfter: updated.stock.stockedQuantity ?? update.stockedQuantity,
            observedBefore: before.stock.stockedQuantity,
            productId: update.productId,
            reason: "manual_count",
            sourceId: `${idempotencyKey}:${update.productId}:${update.variantId}`,
            sourceType: "manual_adjustment",
            tenantId: merchant.result.context.tenantId,
            variantId: update.variantId,
          });
          return updated;
        },
      });
    let result: Awaited<ReturnType<typeof applyUpdates>>;
    if (options.executeMerchantMutation) {
      const execution = await options.executeMerchantMutation(
        {
          actorUserId: merchant.session.user.id,
          idempotencyKey,
          operation: "inventory.stock.batch",
          payload: { reason: "manual_count", stockLocationId, updates: parsed.updates },
          requestId: context.get("requestId"),
          resourceKeys: parsed.updates.flatMap((update) => [
            `inventory:${stockLocationId}:${update.productId}`,
            `inventory:${stockLocationId}:${update.productId}:${update.variantId}`,
          ]),
          source: "assisted_sale",
          tenantId: merchant.result.context.tenantId,
        },
        applyUpdates,
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      context.header("x-idempotent-replay", String(execution.replayed));
      result = execution.value;
    } else {
      result = await applyUpdates();
    }
    return context.json(result);
  });

  app.post("/platform/merchant/products/import/dry-run", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["import"] });
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
    const merchant = await getAuthorizedMerchantContext(context, { products: ["import"] });
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
    const merchant = await getAuthorizedMerchantContext(context, { products: ["import"] });
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
    const merchant = await getAuthorizedMerchantContext(context, { products: ["read"] });

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
      stockLocationId: commerce.context.medusaStockLocationId,
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
      permission: { products: ["read"] },
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

  app.get("/platform/merchant/products/:productId/inventory-movements", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["read"] });
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context, { requireStockLocation: true });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.listMerchantInventoryMovements) {
      return context.json({ error: "inventory_movement_ledger_unavailable" }, 503);
    }
    const locationId = commerce.context.medusaStockLocationId;
    if (!locationId) return context.json({ error: "inventory_location_unavailable" }, 503);
    return context.json(
      await options.listMerchantInventoryMovements({
        limit: getPaginationValue(context.req.query("limit"), 25, 100),
        locationId,
        offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
        productId: context.req.param("productId"),
        tenantId: merchant.result.context.tenantId,
        ...(context.req.query("variantId")?.trim()
          ? { variantId: context.req.query("variantId")?.trim() }
          : {}),
      }),
    );
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
      permission: { products: ["update"] },
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
    const updateProductStock = options.updateMerchantProductStock;
    const getProductStock = options.getMerchantProductStock;
    const appendMovement = options.appendMerchantInventoryMovement;
    if (!getProductStock || !appendMovement) {
      return context.json({ error: "inventory_movement_ledger_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");
    const reason = merchantInventoryMovementReasonSchema.safeParse(
      getOptionalBodyString(body, "reason") ?? "manual_count",
    );
    const note = getOptionalBodyString(body, "note")?.trim() || null;

    if (stockedQuantity === undefined || stockedQuantity < 0 || !reason.success) {
      return context.json({ error: "invalid_stocked_quantity" }, 400);
    }
    if (["correction_add", "correction_remove"].includes(reason.data) && !note) {
      return context.json({ error: "inventory_movement_note_required" }, 400);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const productId = context.req.param("productId");
    const mutationInput = {
      productId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
      stockedQuantity,
    };
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const updateStock = async () => {
      const before = await getProductStock({
        productId,
        salesChannelId: commerce.context.medusaSalesChannelId,
        stockLocationId,
      });
      if (!before.ok) return before;
      if (!before.stock.inventoryItemId) {
        return { ok: false as const, error: "product_inventory_unavailable", status: 409 as const };
      }
      const updated = await updateProductStock(mutationInput);
      if (!updated.ok) return updated;
      await appendMovement({
        actorUserId: session.user.id,
        delta:
          (updated.stock.stockedQuantity ?? stockedQuantity) - (before.stock.stockedQuantity ?? 0),
        inventoryItemId: before.stock.inventoryItemId,
        locationId: stockLocationId,
        note,
        observedAfter: updated.stock.stockedQuantity ?? stockedQuantity,
        observedBefore: before.stock.stockedQuantity,
        productId,
        reason: reason.data,
        sourceId: idempotencyKey,
        sourceType: "manual_adjustment",
        tenantId: result.context.tenantId,
        variantId: before.stock.variantId,
      });
      return updated;
    };
    let stock: Awaited<ReturnType<typeof updateStock>>;
    if (options.executeMerchantMutation) {
      const execution = await options.executeMerchantMutation(
        {
          actorUserId: session.user.id,
          idempotencyKey,
          operation: "inventory.stock.set",
          payload: { ...mutationInput, note, reason: reason.data },
          requestId: context.get("requestId"),
          resourceKeys: [`inventory:${stockLocationId}:${productId}`],
          source: "assisted_sale",
          tenantId: result.context.tenantId,
        },
        updateStock,
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      context.header("x-idempotent-replay", String(execution.replayed));
      stock = execution.value;
    } else {
      stock = await updateStock();
    }

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
      permission: { products: ["read"] },
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
      permission: { products: ["update"] },
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
    const updateVariantStock = options.updateMerchantProductVariantStock;
    const getVariantStock = options.getMerchantProductVariantStock;
    const appendMovement = options.appendMerchantInventoryMovement;
    if (!getVariantStock || !appendMovement) {
      return context.json({ error: "inventory_movement_ledger_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");
    const reason = merchantInventoryMovementReasonSchema.safeParse(
      getOptionalBodyString(body, "reason") ?? "manual_count",
    );
    const note = getOptionalBodyString(body, "note")?.trim() || null;

    if (
      stockedQuantity === undefined ||
      stockedQuantity < 0 ||
      !Number.isInteger(stockedQuantity) ||
      !reason.success
    ) {
      return context.json({ error: "invalid_stocked_quantity" }, 400);
    }
    if (["correction_add", "correction_remove"].includes(reason.data) && !note) {
      return context.json({ error: "inventory_movement_note_required" }, 400);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const productId = context.req.param("productId");
    const variantId = context.req.param("variantId");
    const mutationInput = {
      productId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
      stockedQuantity,
      variantId,
    };
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const updateStock = async () => {
      const before = await getVariantStock({
        productId,
        salesChannelId: commerce.context.medusaSalesChannelId,
        stockLocationId,
        variantId,
      });
      if (!before.ok) return before;
      if (!before.stock.inventoryItemId) {
        return { ok: false as const, error: "product_inventory_unavailable", status: 409 as const };
      }
      const updated = await updateVariantStock(mutationInput);
      if (!updated.ok) return updated;
      await appendMovement({
        actorUserId: session.user.id,
        delta:
          (updated.stock.stockedQuantity ?? stockedQuantity) - (before.stock.stockedQuantity ?? 0),
        inventoryItemId: before.stock.inventoryItemId,
        locationId: stockLocationId,
        note,
        observedAfter: updated.stock.stockedQuantity ?? stockedQuantity,
        observedBefore: before.stock.stockedQuantity,
        productId,
        reason: reason.data,
        sourceId: idempotencyKey,
        sourceType: "manual_adjustment",
        tenantId: result.context.tenantId,
        variantId,
      });
      return updated;
    };
    let stock: Awaited<ReturnType<typeof updateStock>>;
    if (options.executeMerchantMutation) {
      const execution = await options.executeMerchantMutation(
        {
          actorUserId: session.user.id,
          idempotencyKey,
          operation: "inventory.stock.set",
          payload: { ...mutationInput, note, reason: reason.data },
          requestId: context.get("requestId"),
          resourceKeys: [
            `inventory:${stockLocationId}:${productId}`,
            `inventory:${stockLocationId}:${productId}:${variantId}`,
          ],
          source: "assisted_sale",
          tenantId: result.context.tenantId,
        },
        updateStock,
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      context.header("x-idempotent-replay", String(execution.replayed));
      stock = execution.value;
    } else {
      stock = await updateStock();
    }

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.post("/platform/merchant/products/batch-delete", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["delete"] });
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
      permission: { products: ["update"] },
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
    const productVariants = getOptionalBodyProductVariants(body);
    const optionMediaBindings = getOptionalBodyOptionMediaBindings(body);
    const mediaChanged =
      body !== null &&
      typeof body === "object" &&
      ["imageUrls", "thumbnail", "variants", "options", "optionMediaBindings"].some(
        (key) => key in body,
      );
    const command = await runProductWriteCommand(
      {
        getProduct: options.getMerchantProduct,
        syncProductMedia: options.syncProductMedia,
        write: () =>
          options.updateMerchantProduct!({
            productId: context.req.param("productId"),
            title: getOptionalBodyString(body, "title"),
            description: getOptionalBodyString(body, "description"),
            handle: getOptionalBodyString(body, "handle"),
            collectionId: getOptionalBodyString(body, "collectionId"),
            categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
            imageUrls: getOptionalBodyStringArray(body, "imageUrls"),
            ...(optionMediaBindings !== undefined ? { optionMediaBindings } : {}),
            ...(productOptions ? { options: productOptions } : {}),
            ...(productVariants ? { variants: productVariants } : {}),
            regionId: commerce.context.medusaRegionId,
            status: getOptionalBodyString(body, "status"),
            ...(result.context.medusaStockLocationId
              ? { stockLocationId: result.context.medusaStockLocationId }
              : {}),
            thumbnail: getOptionalBodyString(body, "thumbnail"),
            salesChannelId: commerce.context.medusaSalesChannelId,
            tenantId: result.context.tenantId,
          }),
      },
      {
        productId: context.req.param("productId"),
        salesChannelId: commerce.context.medusaSalesChannelId,
        synchronizeMedia: mediaChanged,
        tenantId: result.context.tenantId,
      },
    );
    const product = command.result;

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
      mediaSyncWarning: command.mediaSyncWarning,
    });
  });

  app.delete("/platform/merchant/products/:productId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["delete"] });
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

  app.get("/platform/merchant/product-option-sets", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantProductOptionSets) {
      return context.json({ error: "product_option_sets_unavailable" }, 500);
    }
    const result = await options.listMerchantProductOptionSets({
      tenantId: merchant.result.context.tenantId,
    });
    return context.json({ optionSets: result.optionSets });
  });

  app.post("/platform/merchant/product-option-sets", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["update"] });
    if (!merchant.ok) return merchant.response;
    if (!options.createMerchantProductOptionSet) {
      return context.json({ error: "product_option_sets_unavailable" }, 500);
    }
    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");
    const values = getProductOptionSetValues(body);
    if (!title || !values) return context.json({ error: "invalid_product_option_set" }, 400);
    const result = await options.createMerchantProductOptionSet({
      tenantId: merchant.result.context.tenantId,
      title,
      values,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ optionSet: result.optionSet }, 201);
  });

  app.post("/platform/merchant/product-option-sets/:optionSetId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["update"] });
    if (!merchant.ok) return merchant.response;
    if (!options.updateMerchantProductOptionSet) {
      return context.json({ error: "product_option_sets_unavailable" }, 500);
    }
    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");
    const values = getProductOptionSetValues(body);
    if (!title || !values) return context.json({ error: "invalid_product_option_set" }, 400);
    const result = await options.updateMerchantProductOptionSet({
      tenantId: merchant.result.context.tenantId,
      optionSetId: context.req.param("optionSetId"),
      title,
      values,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ optionSet: result.optionSet });
  });

  app.delete("/platform/merchant/product-option-sets/:optionSetId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { products: ["delete"] });
    if (!merchant.ok) return merchant.response;
    if (!options.deleteMerchantProductOptionSet) {
      return context.json({ error: "product_option_sets_unavailable" }, 500);
    }
    const result = await options.deleteMerchantProductOptionSet({
      tenantId: merchant.result.context.tenantId,
      optionSetId: context.req.param("optionSetId"),
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ ok: true });
  });
}

async function listProductsByInventory(input: {
  filter: "low_stock" | "out_of_stock";
  filters: Omit<
    import("../../modules/commerce/product-list-filters.js").ProductListFilters,
    "inventory"
  >;
  limit: number;
  listProducts: NonNullable<PlatformAppOptions["listMerchantProducts"]>;
  offset: number;
  salesChannelId: string;
  stockLocationId?: string | null | undefined;
}) {
  const all: MerchantProduct[] = [];
  let scanOffset = 0;
  for (;;) {
    const page = await input.listProducts({
      ...input.filters,
      limit: 100,
      offset: scanOffset,
      salesChannelId: input.salesChannelId,
      stockLocationId: input.stockLocationId,
    });
    if (!page.ok) return page;
    all.push(...page.products);
    scanOffset += page.products.length;
    if (page.products.length === 0 || scanOffset >= page.count) break;
  }
  const filtered = filterProductsByInventory(all, input.filter, getLowStockThreshold());
  return {
    count: filtered.length,
    limit: input.limit,
    offset: input.offset,
    ok: true as const,
    products: filtered.slice(input.offset, input.offset + input.limit),
  };
}
