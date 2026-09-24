import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProductCsv } from "../../src/modules/data-transfer/product-export.js";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant products and imports", () => {
  it("lists merchant products scoped to the resolved tenant sales channel", async () => {
    let productsInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listMerchantProducts: async (input) => {
          productsInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            products: [
              {
                id: "prod_1",
                title: "Coffee",
                handle: "coffee",
                status: "published",
                thumbnail: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products?limit=5&offset=10", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productsInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
    });
    assert.deepEqual(await response.json(), {
      products: [
        {
          id: "prod_1",
          title: "Coffee",
          handle: "coffee",
          status: "published",
          thumbnail: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("dry-runs a tenant-scoped product CSV without invoking mutations", async () => {
    const product = {
      id: "prod_1",
      title: "ቡና",
      handle: "buna",
      status: "published",
      thumbnail: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      variants: [
        {
          id: "var_1",
          title: "Default",
          sku: "BUNA-1",
          prices: [{ amount: 250, currencyCode: "etb" }],
        },
      ],
    };
    const listInputs: Array<{ limit: number; offset: number; salesChannelId: string }> = [];
    let reviewedArtifactInput:
      | { csv: string; tenantId: string; userId: string; writes: unknown[] }
      | undefined;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        createReviewedProductImportArtifact: async (input) => {
          reviewedArtifactInput = input;
          return {
            contentDigest: "a".repeat(64),
            expiresAt: "2026-08-25T00:30:00.000Z",
            id: "artifact_1",
            schemaVersion: "ecs-products-v2",
            status: "reviewed",
            summary: { blocked: 0, creates: 0, products: 1, rows: 1, updates: 1 },
          };
        },
        listMerchantProducts: async (input) => {
          listInputs.push(input);
          return {
            ok: true,
            products: [product],
            count: 1,
            limit: input.limit,
            offset: input.offset,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products/import/dry-run", {
      body: buildProductCsv([product]).csv,
      headers: { "content-type": "text/csv", Host: "abebe.lvh.me" },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(listInputs, [{ limit: 100, offset: 0, salesChannelId: "channel_1" }]);
    const report = (await response.json()) as {
      artifact: { id: string; summary: unknown };
      issues: unknown[];
      summary: unknown;
    };
    assert.deepEqual(report.issues, []);
    assert.deepEqual(report.summary, { blocked: 0, creates: 0, rows: 1, updates: 1 });
    assert.equal(report.artifact.id, "artifact_1");
    assert.deepEqual(report.artifact.summary, {
      blocked: 0,
      creates: 0,
      products: 1,
      rows: 1,
      updates: 1,
    });
    assert.equal(reviewedArtifactInput?.tenantId, "tenant_1");
    assert.equal(reviewedArtifactInput?.userId, "user_1");
    assert.equal(reviewedArtifactInput?.writes.length, 1);
  });

  it("queues a digest-confirmed product import for the authenticated tenant", async () => {
    let applyInput: Record<string, unknown> | undefined;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        requestProductImportApply: async (input) => {
          applyInput = input;
          return {
            ok: true,
            execution: {
              artifactId: input.artifactId,
              contentDigest: input.contentDigest,
              failedProducts: 0,
              id: "execution_1",
              jobRunId: "job_1",
              status: "queued",
              succeededProducts: 0,
              totalProducts: 2,
            },
            reused: false,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products/import/apply", {
      body: JSON.stringify({
        artifactId: "artifact_1",
        contentDigest: "a".repeat(64),
        idempotencyKey: "merchant-import-0001",
      }),
      headers: { "content-type": "application/json", Host: "abebe.lvh.me" },
      method: "POST",
    });

    assert.equal(response.status, 202);
    assert.deepEqual(applyInput, {
      artifactId: "artifact_1",
      contentDigest: "a".repeat(64),
      idempotencyKey: "merchant-import-0001",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.equal(
      ((await response.json()) as { execution: { status: string } }).execution.status,
      "queued",
    );
  });

  it("reads product import progress only through the resolved merchant tenant", async () => {
    let statusInput: Record<string, unknown> | undefined;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        getProductImportExecution: async (input) => {
          statusInput = input;
          return {
            ok: true,
            execution: {
              artifactId: "artifact_1",
              contentDigest: "a".repeat(64),
              createdAt: "2026-08-25T00:00:00.000Z",
              cursor: 2,
              error: null,
              failedProducts: 1,
              finishedAt: "2026-08-25T00:01:00.000Z",
              id: input.executionId,
              jobRunId: "job_1",
              outcomes: [
                {
                  errorCode: "product_conflict",
                  errorMessage: "product_conflict",
                  productId: null,
                  productKey: "create:buna",
                  sourceRows: [2],
                  status: "failed",
                },
              ],
              status: "completed_with_errors",
              succeededProducts: 1,
              totalProducts: 2,
              updatedAt: "2026-08-25T00:01:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/merchant/products/import/executions/execution_1",
      { headers: { Host: "abebe.lvh.me" } },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(statusInput, { executionId: "execution_1", tenantId: "tenant_1" });
    const body = (await response.json()) as { execution: { outcomes: unknown[]; status: string } };
    assert.equal(body.execution.status, "completed_with_errors");
    assert.equal(body.execution.outcomes.length, 1);
  });

  it("returns merchant product details scoped to the resolved tenant sales channel", async () => {
    let productInput:
      | {
          productId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: input.productId,
              categoryIds: ["pcat_1"],
              collectionId: "pcol_1",
              description: "Roasted coffee beans",
              title: "Coffee",
              handle: "coffee",
              status: "published",
              thumbnail: null,
              variants: [
                {
                  id: "variant_1",
                  inventoryItemId: "iitem_1",
                  title: "Default",
                  sku: "COF-1",
                  prices: [{ amount: 350, currencyCode: "etb" }],
                },
              ],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products/prod_1", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
    });
    assert.deepEqual(await response.json(), {
      product: {
        id: "prod_1",
        categoryIds: ["pcat_1"],
        collectionId: "pcol_1",
        description: "Roasted coffee beans",
        title: "Coffee",
        handle: "coffee",
        status: "published",
        thumbnail: null,
        variants: [
          {
            id: "variant_1",
            inventoryItemId: "iitem_1",
            title: "Default",
            sku: "COF-1",
            prices: [{ amount: 350, currencyCode: "etb" }],
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });
});
