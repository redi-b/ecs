import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  auditLogs,
  createPlatformDb,
  productImportArtifacts,
  productImportExecutions,
  productImportOutcomes,
  tenants,
} from "@ecs/db";
import { and, eq, inArray } from "drizzle-orm";

import {
  createProductImportApplyHandler,
  createProductImportApplyStore,
  type ProductImportApplyCommerce,
} from "../../jobs/handlers/product-import-apply.js";
import { createProductImportArtifactService } from "./product-import-artifact.js";
import { createProductImportExecutionService } from "./product-import-execution.js";
import type { ProductImportWrite } from "./product-import-plan.js";

const connectionString = process.env.PLATFORM_IMPORT_INTEGRATION_DATABASE_URL?.trim();

const writes: ProductImportWrite[] = [
  {
    action: "update",
    categoryIds: [],
    collectionId: null,
    description: null,
    handle: "buna",
    imageUrls: [],
    productId: "prod_1",
    sourceRows: [2, 3],
    status: "published",
    thumbnail: null,
    title: "ቡና",
    variants: [],
  },
  {
    action: "create",
    categoryIds: [],
    collectionId: null,
    description: null,
    handle: "shiro",
    imageUrls: [],
    productId: null,
    sourceRows: [4],
    status: "draft",
    thumbnail: null,
    title: "ሽሮ",
    variants: [],
  },
];

describe("product import execution PostgreSQL boundary", () => {
  it(
    "reserves one tenant idempotency key, seeds outcomes, and enqueues once",
    { skip: !connectionString && "PLATFORM_IMPORT_INTEGRATION_DATABASE_URL is not set" },
    async () => {
      if (!connectionString) return;
      const platform = createPlatformDb({ connectionString, max: 1 });
      const artifactIds: string[] = [];
      const executionIds: string[] = [];
      let enqueueCalls = 0;
      try {
        const [tenant] = await platform.db.select({ id: tenants.id }).from(tenants).limit(1);
        assert.ok(tenant, "integration database needs one migrated tenant");
        const artifactService = createProductImportArtifactService(platform.db, {
          now: () => new Date("2026-08-25T12:00:00.000Z"),
        });
        const artifact = await artifactService.createReviewedArtifact({
          csv: "reviewed-one",
          dryRun: {
            issues: [],
            plans: [],
            summary: { blocked: 0, creates: 1, rows: 3, updates: 2 },
          },
          tenantId: tenant.id,
          userId: "product_import_execution_test",
          writes,
        });
        artifactIds.push(artifact.id);
        const service = createProductImportExecutionService(platform.db, {
          now: () => new Date("2026-08-25T12:05:00.000Z"),
          enqueue: async () => {
            enqueueCalls += 1;
            return { jobRunId: randomUUID() };
          },
        });
        const input = {
          artifactId: artifact.id,
          contentDigest: artifact.contentDigest,
          idempotencyKey: "merchant-import-0001",
          tenantId: tenant.id,
          userId: "product_import_execution_test",
        };

        const first = await service.requestApply(input);
        assert.equal(first.ok, true);
        if (!first.ok) return;
        executionIds.push(first.execution.id);
        assert.equal(first.reused, false);
        assert.equal(first.execution.status, "queued");
        assert.equal(first.execution.totalProducts, 2);

        const second = await service.requestApply(input);
        assert.equal(second.ok, true);
        assert.equal(second.ok && second.reused, true);
        assert.equal(enqueueCalls, 1);

        const outcomes = await platform.db
          .select({ productKey: productImportOutcomes.productKey })
          .from(productImportOutcomes)
          .where(eq(productImportOutcomes.executionId, first.execution.id));
        assert.deepEqual(outcomes.map((outcome) => outcome.productKey).sort(), [
          "create:shiro",
          "update:prod_1",
        ]);

        const productResult = (id: string, title: string, handle: string) => ({
          ok: true as const,
          product: {
            id,
            title,
            handle,
            status: "draft" as const,
            thumbnail: null,
            variants: [],
            createdAt: null,
            updatedAt: null,
          },
        });
        const commerce: ProductImportApplyCommerce = {
          findImportedProduct: async () => ({ ok: true, product: null }),
          createProduct: async (write) =>
            productResult("prod_shiro", write.title ?? "Untitled", write.handle ?? "shiro"),
          updateProduct: async (write) =>
            productResult(write.productId, write.title ?? "Untitled", write.handle ?? "buna"),
          updateVariantStock: async () => {
            throw new Error("writes without variants must not update stock");
          },
        };
        const applied = await createProductImportApplyHandler({
          commerce,
          store: createProductImportApplyStore(platform.db),
        })({
          attempt: 2,
          jobRunId: randomUUID(),
          name: "product-import.apply",
          payload: { executionId: first.execution.id },
          tenantId: tenant.id,
        });
        assert.deepEqual(applied, {
          ok: true,
          executionId: first.execution.id,
          failed: 0,
          succeeded: 2,
        });
        const status = await service.getExecution({
          executionId: first.execution.id,
          tenantId: tenant.id,
        });
        assert.equal(status.ok, true);
        if (status.ok) {
          assert.equal(status.execution.status, "completed");
          assert.equal(status.execution.cursor, 2);
          assert.equal(status.execution.succeededProducts, 2);
        }
        const persistedOutcomes = await platform.db
          .select({
            attempts: productImportOutcomes.attempts,
            status: productImportOutcomes.status,
          })
          .from(productImportOutcomes)
          .where(eq(productImportOutcomes.executionId, first.execution.id));
        assert.deepEqual(persistedOutcomes.map((outcome) => outcome.status).sort(), [
          "succeeded",
          "succeeded",
        ]);
        assert.deepEqual(
          persistedOutcomes.map((outcome) => outcome.attempts),
          [2, 2],
        );

        const [audit] = await platform.db
          .select({ action: auditLogs.action })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.action, "product_import.apply_requested"),
              eq(auditLogs.targetId, first.execution.id),
            ),
          )
          .limit(1);
        assert.deepEqual(audit, { action: "product_import.apply_requested" });

        const otherArtifact = await artifactService.createReviewedArtifact({
          csv: "reviewed-two",
          dryRun: {
            issues: [],
            plans: [],
            summary: { blocked: 0, creates: 1, rows: 1, updates: 0 },
          },
          tenantId: tenant.id,
          userId: "product_import_execution_test",
          writes: [writes[1] as ProductImportWrite],
        });
        artifactIds.push(otherArtifact.id);
        const conflict = await service.requestApply({
          ...input,
          artifactId: otherArtifact.id,
          contentDigest: otherArtifact.contentDigest,
        });
        assert.deepEqual(conflict, {
          ok: false,
          error: "product_import_idempotency_conflict",
          status: 409,
        });
      } finally {
        if (executionIds.length > 0) {
          await platform.db
            .delete(productImportOutcomes)
            .where(inArray(productImportOutcomes.executionId, executionIds));
          await platform.db.delete(auditLogs).where(inArray(auditLogs.targetId, executionIds));
          await platform.db
            .delete(productImportExecutions)
            .where(inArray(productImportExecutions.id, executionIds));
        }
        if (artifactIds.length > 0) {
          await platform.db.delete(auditLogs).where(inArray(auditLogs.targetId, artifactIds));
          await platform.db
            .delete(productImportArtifacts)
            .where(inArray(productImportArtifacts.id, artifactIds));
        }
        await platform.pool.end();
      }
    },
  );
});
