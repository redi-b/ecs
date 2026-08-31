import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createProductImportApplyHandler,
  type ProductImportApplyCommerce,
  type ProductImportApplyStore,
} from "./product-import-apply.js";

function write() {
  return {
    action: "create" as const,
    categoryIds: [],
    collectionId: null,
    description: null,
    handle: "buna",
    imageUrls: [],
    optionPresentations: [
      {
        optionTitle: "Size",
        valueLabel: "250g",
        swatch: { kind: "color" as const, value: "#4a2c1b" },
      },
    ],
    productId: null,
    sourceRows: [2],
    status: "draft",
    thumbnail: null,
    title: "ቡና",
    variants: [
      {
        currencyPrices: [{ amount: 250, currencyCode: "etb" }],
        id: null,
        optionValues: { Size: "250g" },
        row: 2,
        sku: "BUNA-1",
        stockedQuantity: 7,
        title: "250g",
      },
    ],
  };
}

function context() {
  return {
    executionId: "execution_1",
    salesChannelId: "sc_1",
    stockLocationId: "sloc_1",
    regionId: "reg_1",
    shippingProfileId: "sp_1",
    tenantId: "tenant_1",
    writes: [write()],
  };
}

function job() {
  return {
    attempt: 1,
    jobRunId: "job_1",
    name: "product-import.apply",
    payload: { executionId: "execution_1" },
    tenantId: "tenant_1",
  };
}

describe("product import apply handler", () => {
  it("creates, stocks, records success, and finishes one pending product", async () => {
    const events: string[] = [];
    let createInput: Record<string, unknown> | undefined;
    const store: ProductImportApplyStore = {
      load: async () => context(),
      listPending: async () => [{ id: "outcome_1", productKey: "create:buna" }],
      markActive: async () => {
        events.push("active");
      },
      markSucceeded: async (input) => {
        events.push(`succeeded:${input.productId}`);
      },
      markFailed: async () => {
        events.push("failed");
      },
      finish: async () => {
        events.push("finished");
        return { failed: 0, succeeded: 1 };
      },
    };
    const commerce: ProductImportApplyCommerce = {
      findImportedProduct: async () => ({ ok: true, product: null }),
      createProduct: async (input) => {
        createInput = input;
        return {
          ok: true,
          product: {
            id: "prod_created",
            title: "ቡና",
            handle: "buna",
            status: "draft",
            thumbnail: null,
            variants: [
              {
                id: "variant_created",
                title: "250g",
                sku: "BUNA-1",
                prices: [{ amount: 250, currencyCode: "etb" }],
              },
            ],
            createdAt: null,
            updatedAt: null,
          },
        };
      },
      updateProduct: async () => {
        throw new Error("unexpected update");
      },
      updateVariantStock: async (input) => {
        events.push(`stock:${input.variantId}:${input.stockedQuantity}`);
        return {
          ok: true,
          stock: {
            productId: input.productId,
            variantId: input.variantId,
            inventoryItemId: "iitem_1",
            locationId: input.stockLocationId,
            stockedQuantity: input.stockedQuantity,
            reservedQuantity: null,
            incomingQuantity: null,
            availableQuantity: null,
          },
        };
      },
    };

    const result = await createProductImportApplyHandler({ commerce, store })(job());
    assert.deepEqual(result, { ok: true, executionId: "execution_1", failed: 0, succeeded: 1 });
    assert.deepEqual(events, [
      "active",
      "stock:variant_created:7",
      "succeeded:prod_created",
      "finished",
    ]);
    assert.deepEqual(createInput?.metadata, {
      ecs_import_execution_id: "execution_1",
      ecs_import_product_key: "create:buna",
    });
    assert.deepEqual(createInput?.options, [
      {
        title: "Size",
        values: [
          { label: "250g", swatch: { kind: "color", value: "#4a2c1b" } },
        ],
      },
    ]);
  });

  it("leaves the outcome pending and rethrows transient commerce failures", async () => {
    let marked = false;
    const store: ProductImportApplyStore = {
      load: async () => context(),
      listPending: async () => [{ id: "outcome_1", productKey: "create:buna" }],
      markActive: async () => undefined,
      markSucceeded: async () => {
        marked = true;
      },
      markFailed: async () => {
        marked = true;
      },
      finish: async () => {
        marked = true;
        return { failed: 0, succeeded: 0 };
      },
    };
    const commerce: ProductImportApplyCommerce = {
      findImportedProduct: async () => ({
        ok: false as const,
        error: "commerce_backend_unavailable",
        status: 503,
      }),
      createProduct: async () => {
        throw new Error("unexpected create");
      },
      updateProduct: async () => {
        throw new Error("unexpected update");
      },
      updateVariantStock: async () => {
        throw new Error("unexpected stock update");
      },
    };

    await assert.rejects(
      createProductImportApplyHandler({ commerce, store })(job()),
      /commerce_backend_unavailable/,
    );
    assert.equal(marked, false);
  });

  it("resumes a previously created product without creating it again", async () => {
    const events: string[] = [];
    const store: ProductImportApplyStore = {
      load: async () => context(),
      listPending: async () => [{ id: "outcome_1", productKey: "create:buna" }],
      markActive: async () => undefined,
      markSucceeded: async (input) => {
        events.push(`succeeded:${input.productId}`);
      },
      markFailed: async () => {
        events.push("failed");
      },
      finish: async () => ({ failed: 0, succeeded: 1 }),
    };
    const commerce: ProductImportApplyCommerce = {
      findImportedProduct: async () => ({
        ok: true,
        product: { id: "prod_existing", variantIdsBySku: { "buna-1": "variant_existing" } },
      }),
      createProduct: async () => {
        throw new Error("create must not run after reconciliation");
      },
      updateProduct: async () => {
        throw new Error("unexpected update");
      },
      updateVariantStock: async (input) => {
        events.push(`stock:${input.variantId}`);
        return {
          ok: true,
          stock: {
            productId: input.productId,
            variantId: input.variantId,
            inventoryItemId: "iitem_1",
            locationId: input.stockLocationId,
            stockedQuantity: input.stockedQuantity,
            reservedQuantity: null,
            incomingQuantity: null,
            availableQuantity: null,
          },
        };
      },
    };

    const result = await createProductImportApplyHandler({ commerce, store })(job());

    assert.deepEqual(result, { ok: true, executionId: "execution_1", failed: 0, succeeded: 1 });
    assert.deepEqual(events, ["stock:variant_existing", "succeeded:prod_existing"]);
  });

  it("records a permanent product conflict and completes with errors", async () => {
    const failures: Array<Record<string, unknown>> = [];
    let finished = false;
    const store: ProductImportApplyStore = {
      load: async () => context(),
      listPending: async () => [{ id: "outcome_1", productKey: "create:buna" }],
      markActive: async () => undefined,
      markSucceeded: async () => {
        throw new Error("unexpected success");
      },
      markFailed: async (input) => {
        failures.push(input);
      },
      finish: async () => {
        finished = true;
        return { failed: 1, succeeded: 0 };
      },
    };
    const commerce: ProductImportApplyCommerce = {
      findImportedProduct: async () => ({ ok: false, error: "product_conflict", status: 409 }),
      createProduct: async () => {
        throw new Error("unexpected create");
      },
      updateProduct: async () => {
        throw new Error("unexpected update");
      },
      updateVariantStock: async () => {
        throw new Error("unexpected stock update");
      },
    };

    const result = await createProductImportApplyHandler({ commerce, store })(job());

    assert.deepEqual(result, { ok: true, executionId: "execution_1", failed: 1, succeeded: 0 });
    assert.equal(finished, true);
    assert.deepEqual(failures, [
      {
        attempt: 1,
        errorCode: "product_conflict",
        errorMessage: "product_conflict",
        executionId: "execution_1",
        outcomeId: "outcome_1",
      },
    ]);
  });
});
