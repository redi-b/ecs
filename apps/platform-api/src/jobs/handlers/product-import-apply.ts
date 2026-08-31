import type { createPlatformDb } from "@ecs/db";
import {
  productImportArtifacts,
  productImportExecutions,
  productImportOutcomes,
  tenants,
} from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";
import { and, asc, eq, sql } from "drizzle-orm";

import type {
  ProductVariantWriteInput,
  ProductWriteInput,
} from "../../adapters/medusa/product/types.js";
import { isProductImportWritePlan } from "../../modules/data-transfer/product-import-execution.js";
import type { ProductImportWrite } from "../../modules/data-transfer/product-import-plan.js";
import type {
  MerchantProductStockUpdateResult,
  MerchantProductWriteResult,
} from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type ImportProduct = { id: string; variantIdsBySku: Record<string, string> };
type ImportExecutionContext = {
  executionId: string;
  salesChannelId: string;
  stockLocationId: string | null;
  regionId: string | null;
  shippingProfileId: string | null;
  tenantId: string;
  writes: ProductImportWrite[];
};

export type ProductImportApplyStore = {
  finish(executionId: string): Promise<{ failed: number; succeeded: number }>;
  load(executionId: string, tenantId: string): Promise<ImportExecutionContext | null>;
  listPending(executionId: string): Promise<Array<{ id: string; productKey: string }>>;
  markActive(executionId: string, jobRunId: string): Promise<void>;
  markFailed(input: {
    attempt: number;
    errorCode: string;
    errorMessage: string;
    executionId: string;
    outcomeId: string;
  }): Promise<void>;
  markSucceeded(input: {
    attempt: number;
    executionId: string;
    outcomeId: string;
    productId: string;
  }): Promise<void>;
};

export type ProductImportApplyCommerce = {
  createProduct(
    input: ProductWriteInput & { capacityIdempotencyKey: string; tenantId: string },
  ): Promise<MerchantProductWriteResult>;
  findImportedProduct(input: {
    executionId: string;
    handle: string;
    productKey: string;
    salesChannelId: string;
  }): Promise<
    { ok: true; product: ImportProduct | null } | { ok: false; error: string; status: number }
  >;
  updateProduct(
    input: ProductWriteInput & { productId: string },
  ): Promise<MerchantProductWriteResult>;
  updateVariantStock(input: {
    productId: string;
    salesChannelId: string;
    stockLocationId: string;
    stockedQuantity: number;
    variantId: string;
  }): Promise<MerchantProductStockUpdateResult>;
};

function writeKey(write: ProductImportWrite) {
  return write.productId ? `update:${write.productId}` : `create:${write.handle.toLowerCase()}`;
}

function variantsForWrite(write: ProductImportWrite): ProductVariantWriteInput[] {
  return write.variants.map((variant) => ({
    currencyCode: variant.currencyPrices[0]?.currencyCode ?? "etb",
    ...(variant.id ? { id: variant.id } : {}),
    optionValues: variant.optionValues,
    prices: variant.currencyPrices,
    ...(variant.sku ? { sku: variant.sku } : {}),
    ...(variant.stockedQuantity !== null ? { stockedQuantity: variant.stockedQuantity } : {}),
  }));
}

function optionsForWrite(write: ProductImportWrite) {
  const values = new Map<string, Set<string>>();
  for (const variant of write.variants) {
    for (const [title, value] of Object.entries(variant.optionValues)) {
      const entries = values.get(title) ?? new Set<string>();
      entries.add(value);
      values.set(title, entries);
    }
  }
  return [...values.entries()].map(([title, entries]) => ({
    title,
    values: [...entries].map((label) => {
      const presentation = write.optionPresentations?.find(
        (candidate) =>
          candidate.optionTitle.toLocaleLowerCase() === title.toLocaleLowerCase() &&
          candidate.valueLabel.toLocaleLowerCase() === label.toLocaleLowerCase(),
      );
      return presentation ? { label, swatch: presentation.swatch } : label;
    }),
  }));
}

function productInput(
  context: ImportExecutionContext,
  write: ProductImportWrite,
  productKey: string,
): ProductWriteInput {
  return {
    categoryIds: write.categoryIds,
    collectionId: write.collectionId,
    description: write.description,
    handle: write.handle,
    imageUrls: write.imageUrls,
    metadata: {
      ecs_import_execution_id: context.executionId,
      ecs_import_product_key: productKey,
    },
    options: optionsForWrite(write),
    priceAmount: write.variants[0]?.currencyPrices[0]?.amount ?? 0,
    regionId: context.regionId,
    salesChannelId: context.salesChannelId,
    shippingProfileId: context.shippingProfileId,
    status: write.status,
    stockLocationId: context.stockLocationId,
    thumbnail: write.thumbnail,
    title: write.title,
    variants: variantsForWrite(write),
  };
}

function variantIds(product: MerchantProductWriteResult): Record<string, string> {
  if (!product.ok) return {};
  return Object.fromEntries(
    (product.product.variants ?? []).flatMap((variant) =>
      variant.sku ? [[variant.sku.toLowerCase(), variant.id] as const] : [],
    ),
  );
}

function isTransient(result: { status: number }) {
  return result.status === 401 || result.status >= 500;
}

export function createProductImportApplyStore(db: PlatformDb): ProductImportApplyStore {
  return {
    async load(executionId, tenantId) {
      const [execution] = await db
        .select({
          executionId: productImportExecutions.id,
          writePlan: productImportArtifacts.writePlan,
          salesChannelId: tenants.medusaSalesChannelId,
          stockLocationId: tenants.medusaStockLocationId,
          regionId: tenants.medusaRegionId,
          shippingProfileId: tenants.medusaShippingProfileId,
          tenantId: productImportExecutions.tenantId,
        })
        .from(productImportExecutions)
        .innerJoin(
          productImportArtifacts,
          eq(productImportArtifacts.id, productImportExecutions.artifactId),
        )
        .innerJoin(tenants, eq(tenants.id, productImportExecutions.tenantId))
        .where(
          and(
            eq(productImportExecutions.id, executionId),
            eq(productImportExecutions.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!execution?.salesChannelId || !isProductImportWritePlan(execution.writePlan)) return null;
      return {
        executionId: execution.executionId,
        salesChannelId: execution.salesChannelId,
        stockLocationId: execution.stockLocationId,
        regionId: execution.regionId,
        shippingProfileId: execution.shippingProfileId,
        tenantId: execution.tenantId,
        writes: execution.writePlan,
      };
    },
    async listPending(executionId) {
      return db
        .select({ id: productImportOutcomes.id, productKey: productImportOutcomes.productKey })
        .from(productImportOutcomes)
        .where(
          and(
            eq(productImportOutcomes.executionId, executionId),
            eq(productImportOutcomes.status, "pending"),
          ),
        )
        .orderBy(asc(productImportOutcomes.createdAt), asc(productImportOutcomes.productKey));
    },
    async markActive(executionId, jobRunId) {
      await db
        .update(productImportExecutions)
        .set({ status: "active", jobRunId, startedAt: new Date(), updatedAt: new Date() })
        .where(eq(productImportExecutions.id, executionId));
    },
    async markSucceeded(input) {
      await db.transaction(async (transaction) => {
        await transaction
          .update(productImportOutcomes)
          .set({
            status: "succeeded",
            productId: input.productId,
            attempts: input.attempt,
            updatedAt: new Date(),
          })
          .where(eq(productImportOutcomes.id, input.outcomeId));
        await transaction
          .update(productImportExecutions)
          .set({
            cursor: sql`${productImportExecutions.cursor} + 1`,
            succeededProducts: sql`${productImportExecutions.succeededProducts} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(productImportExecutions.id, input.executionId));
      });
    },
    async markFailed(input) {
      await db.transaction(async (transaction) => {
        await transaction
          .update(productImportOutcomes)
          .set({
            status: "failed",
            errorCode: input.errorCode,
            errorMessage: input.errorMessage,
            attempts: input.attempt,
            updatedAt: new Date(),
          })
          .where(eq(productImportOutcomes.id, input.outcomeId));
        await transaction
          .update(productImportExecutions)
          .set({
            cursor: sql`${productImportExecutions.cursor} + 1`,
            failedProducts: sql`${productImportExecutions.failedProducts} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(productImportExecutions.id, input.executionId));
      });
    },
    async finish(executionId) {
      const outcomes = await db
        .select({ status: productImportOutcomes.status })
        .from(productImportOutcomes)
        .where(eq(productImportOutcomes.executionId, executionId));
      const succeeded = outcomes.filter((outcome) => outcome.status === "succeeded").length;
      const failed = outcomes.filter((outcome) => outcome.status === "failed").length;
      await db
        .update(productImportExecutions)
        .set({
          status: failed > 0 ? "completed_with_errors" : "completed",
          succeededProducts: succeeded,
          failedProducts: failed,
          cursor: succeeded + failed,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(productImportExecutions.id, executionId));
      return { failed, succeeded };
    },
  };
}

export function createProductImportApplyHandler(options: {
  commerce: ProductImportApplyCommerce;
  store: ProductImportApplyStore;
}): JobHandler<{ executionId: string }> {
  return async (job) => {
    const executionId = job.payload?.executionId?.trim();
    const tenantId = job.tenantId?.trim();
    if (!executionId || !tenantId) throw new Error("product_import_job_payload_invalid");
    const context = await options.store.load(executionId, tenantId);
    if (!context) throw new Error("product_import_execution_not_found");
    await options.store.markActive(executionId, job.jobRunId);
    const pending = await options.store.listPending(executionId);
    const writes = new Map(context.writes.map((write) => [writeKey(write), write]));

    for (const outcome of pending) {
      const write = writes.get(outcome.productKey);
      if (!write) throw new Error(`product_import_write_missing:${outcome.productKey}`);
      let productId: string;
      let idsBySku: Record<string, string>;
      if (write.action === "create") {
        const reconciled = await options.commerce.findImportedProduct({
          executionId,
          handle: write.handle,
          productKey: outcome.productKey,
          salesChannelId: context.salesChannelId,
        });
        if (!reconciled.ok) {
          if (isTransient(reconciled)) throw new Error(reconciled.error);
          await options.store.markFailed({
            attempt: job.attempt,
            errorCode: reconciled.error,
            errorMessage: reconciled.error,
            executionId,
            outcomeId: outcome.id,
          });
          continue;
        }
        if (reconciled.product) {
          productId = reconciled.product.id;
          idsBySku = reconciled.product.variantIdsBySku;
        } else {
          const created = await options.commerce.createProduct({
            ...productInput(context, write, outcome.productKey),
            capacityIdempotencyKey: `product-import:${executionId}:${outcome.productKey}`,
            tenantId,
          });
          if (!created.ok) {
            if (isTransient(created)) throw new Error(created.error);
            await options.store.markFailed({
              attempt: job.attempt,
              errorCode: created.error,
              errorMessage: created.error,
              executionId,
              outcomeId: outcome.id,
            });
            continue;
          }
          productId = created.product.id;
          idsBySku = variantIds(created);
        }
      } else {
        const updated = await options.commerce.updateProduct({
          ...productInput(context, write, outcome.productKey),
          productId: write.productId ?? "",
        });
        if (!updated.ok) {
          if (isTransient(updated)) throw new Error(updated.error);
          await options.store.markFailed({
            attempt: job.attempt,
            errorCode: updated.error,
            errorMessage: updated.error,
            executionId,
            outcomeId: outcome.id,
          });
          continue;
        }
        productId = updated.product.id;
        idsBySku = variantIds(updated);
      }

      let stockFailure: { error: string; status: number } | null = null;
      for (const variant of write.variants) {
        if (variant.stockedQuantity === null) continue;
        const variantId = variant.id ?? (variant.sku ? idsBySku[variant.sku.toLowerCase()] : null);
        if (!context.stockLocationId || !variantId) {
          stockFailure = { error: "product_import_inventory_context_missing", status: 409 };
          break;
        }
        const stock = await options.commerce.updateVariantStock({
          productId,
          salesChannelId: context.salesChannelId,
          stockLocationId: context.stockLocationId,
          stockedQuantity: variant.stockedQuantity,
          variantId,
        });
        if (!stock.ok) {
          stockFailure = stock;
          break;
        }
      }
      if (stockFailure) {
        if (isTransient(stockFailure)) throw new Error(stockFailure.error);
        await options.store.markFailed({
          attempt: job.attempt,
          errorCode: stockFailure.error,
          errorMessage: stockFailure.error,
          executionId,
          outcomeId: outcome.id,
        });
        continue;
      }
      await options.store.markSucceeded({
        attempt: job.attempt,
        executionId,
        outcomeId: outcome.id,
        productId,
      });
    }

    const summary = await options.store.finish(executionId);
    return { ok: true, executionId, ...summary };
  };
}
