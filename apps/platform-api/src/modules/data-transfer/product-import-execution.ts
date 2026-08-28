import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  productImportArtifacts,
  productImportExecutions,
  productImportOutcomes,
} from "@ecs/db";
import { and, eq } from "drizzle-orm";

import type { ProductImportWrite } from "./product-import-plan.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type ProductImportEnqueue = (input: {
  idempotencyKey: string;
  name: "product-import.apply";
  payload: { executionId: string };
  tenantId: string;
}) => Promise<{ jobRunId: string }>;

export type ProductImportApplyResult =
  | {
      ok: true;
      execution: {
        artifactId: string;
        contentDigest: string;
        failedProducts: number;
        id: string;
        jobRunId: string;
        status: "queued";
        succeededProducts: number;
        totalProducts: number;
      };
      reused: boolean;
    }
  | {
      ok: false;
      error:
        | "product_import_artifact_expired"
        | "product_import_artifact_not_found"
        | "product_import_digest_mismatch"
        | "product_import_idempotency_conflict"
        | "product_import_idempotency_invalid"
        | "product_import_queue_unavailable";
      status: 400 | 404 | 409 | 503;
    };

function isValidIdempotencyKey(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value);
}

export function isProductImportWritePlan(value: unknown): value is ProductImportWrite[] {
  return (
    Array.isArray(value) &&
    value.every(
      (write) =>
        typeof write === "object" &&
        write !== null &&
        (write as { action?: unknown }).action !== undefined &&
        typeof (write as { handle?: unknown }).handle === "string" &&
        Array.isArray((write as { sourceRows?: unknown }).sourceRows),
    )
  );
}

function productKey(write: ProductImportWrite) {
  return write.productId ? `update:${write.productId}` : `create:${write.handle.toLowerCase()}`;
}

export function createProductImportExecutionService(
  db: PlatformDb,
  options: { enqueue: ProductImportEnqueue; now?: () => Date },
) {
  const now = options.now ?? (() => new Date());

  return {
    getExecution: async (input: { executionId: string; tenantId: string }) => {
      const [execution] = await db
        .select()
        .from(productImportExecutions)
        .where(
          and(
            eq(productImportExecutions.id, input.executionId),
            eq(productImportExecutions.tenantId, input.tenantId),
          ),
        )
        .limit(1);
      if (!execution) {
        return {
          ok: false as const,
          error: "product_import_execution_not_found" as const,
          status: 404 as const,
        };
      }
      const outcomes = await db
        .select({
          errorCode: productImportOutcomes.errorCode,
          errorMessage: productImportOutcomes.errorMessage,
          productId: productImportOutcomes.productId,
          productKey: productImportOutcomes.productKey,
          sourceRows: productImportOutcomes.sourceRows,
          status: productImportOutcomes.status,
        })
        .from(productImportOutcomes)
        .where(eq(productImportOutcomes.executionId, execution.id));
      return {
        ok: true as const,
        execution: {
          artifactId: execution.artifactId,
          contentDigest: execution.contentDigest,
          createdAt: execution.createdAt.toISOString(),
          cursor: execution.cursor,
          error: execution.error,
          failedProducts: execution.failedProducts,
          finishedAt: execution.finishedAt?.toISOString() ?? null,
          id: execution.id,
          jobRunId: execution.jobRunId,
          outcomes,
          status: execution.status,
          succeededProducts: execution.succeededProducts,
          totalProducts: execution.totalProducts,
          updatedAt: execution.updatedAt.toISOString(),
        },
      };
    },
    requestApply: async (input: {
      artifactId: string;
      contentDigest: string;
      idempotencyKey: string;
      tenantId: string;
      userId: string;
    }): Promise<ProductImportApplyResult> => {
      const idempotencyKey = input.idempotencyKey.trim();
      if (!isValidIdempotencyKey(idempotencyKey)) {
        return { ok: false, error: "product_import_idempotency_invalid", status: 400 };
      }
      const requestedAt = now();
      const initialized = await db.transaction(async (transaction) => {
        const [artifact] = await transaction
          .select({
            contentDigest: productImportArtifacts.contentDigest,
            expiresAt: productImportArtifacts.expiresAt,
            id: productImportArtifacts.id,
            writePlan: productImportArtifacts.writePlan,
          })
          .from(productImportArtifacts)
          .where(
            and(
              eq(productImportArtifacts.id, input.artifactId),
              eq(productImportArtifacts.tenantId, input.tenantId),
            ),
          )
          .limit(1);
        if (!artifact || !isProductImportWritePlan(artifact.writePlan)) {
          return { error: "product_import_artifact_not_found" as const, status: 404 as const };
        }
        if (artifact.expiresAt.getTime() <= requestedAt.getTime()) {
          return { error: "product_import_artifact_expired" as const, status: 409 as const };
        }
        if (artifact.contentDigest !== input.contentDigest) {
          return { error: "product_import_digest_mismatch" as const, status: 409 as const };
        }

        const [inserted] = await transaction
          .insert(productImportExecutions)
          .values({
            artifactId: artifact.id,
            tenantId: input.tenantId,
            requestedByUserId: input.userId,
            contentDigest: artifact.contentDigest,
            idempotencyKey,
            status: "pending_enqueue",
            totalProducts: artifact.writePlan.length,
            createdAt: requestedAt,
            updatedAt: requestedAt,
          })
          .onConflictDoNothing({
            target: [productImportExecutions.tenantId, productImportExecutions.idempotencyKey],
          })
          .returning({ id: productImportExecutions.id });

        if (!inserted) {
          const [existing] = await transaction
            .select()
            .from(productImportExecutions)
            .where(
              and(
                eq(productImportExecutions.tenantId, input.tenantId),
                eq(productImportExecutions.idempotencyKey, idempotencyKey),
              ),
            )
            .limit(1);
          if (
            !existing ||
            existing.artifactId !== artifact.id ||
            existing.contentDigest !== artifact.contentDigest
          ) {
            return {
              error: "product_import_idempotency_conflict" as const,
              status: 409 as const,
            };
          }
          return { execution: existing, reused: true as const };
        }

        if (artifact.writePlan.length > 0) {
          await transaction.insert(productImportOutcomes).values(
            artifact.writePlan.map((write) => ({
              executionId: inserted.id,
              tenantId: input.tenantId,
              productKey: productKey(write),
              sourceRows: write.sourceRows,
              status: "pending",
              createdAt: requestedAt,
              updatedAt: requestedAt,
            })),
          );
        }
        await transaction.insert(auditLogs).values({
          correlationId: inserted.id,
          outcome: "accepted",
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "product_import.apply_requested",
          targetType: "product_import_execution",
          targetId: inserted.id,
          metadata: {
            artifactId: artifact.id,
            contentDigest: artifact.contentDigest,
            idempotencyKey,
            totalProducts: artifact.writePlan.length,
          },
        });
        const [execution] = await transaction
          .select()
          .from(productImportExecutions)
          .where(eq(productImportExecutions.id, inserted.id))
          .limit(1);
        if (!execution) throw new Error("Product import execution insert returned no rows.");
        return { execution, reused: false as const };
      });

      if (!("execution" in initialized)) return { ok: false, ...initialized };
      const execution = initialized.execution;
      if (execution.status === "queued" && execution.jobRunId) {
        return {
          ok: true,
          execution: {
            artifactId: execution.artifactId,
            contentDigest: execution.contentDigest,
            failedProducts: execution.failedProducts,
            id: execution.id,
            jobRunId: execution.jobRunId,
            status: "queued",
            succeededProducts: execution.succeededProducts,
            totalProducts: execution.totalProducts,
          },
          reused: true,
        };
      }

      try {
        const job = await options.enqueue({
          idempotencyKey: `product-import:${execution.id}`,
          name: "product-import.apply",
          payload: { executionId: execution.id },
          tenantId: input.tenantId,
        });
        const [queued] = await db
          .update(productImportExecutions)
          .set({
            jobRunId: job.jobRunId,
            status: "queued",
            queuedAt: requestedAt,
            error: null,
            updatedAt: requestedAt,
          })
          .where(eq(productImportExecutions.id, execution.id))
          .returning();
        if (!queued) throw new Error("Queued product import execution update returned no rows.");
        return {
          ok: true,
          execution: {
            artifactId: queued.artifactId,
            contentDigest: queued.contentDigest,
            failedProducts: queued.failedProducts,
            id: queued.id,
            jobRunId: queued.jobRunId ?? job.jobRunId,
            status: "queued",
            succeededProducts: queued.succeededProducts,
            totalProducts: queued.totalProducts,
          },
          reused: initialized.reused === true,
        };
      } catch (error) {
        await db
          .update(productImportExecutions)
          .set({
            status: "failed_enqueue",
            error: error instanceof Error ? error.message : String(error),
            updatedAt: now(),
          })
          .where(eq(productImportExecutions.id, execution.id));
        return { ok: false, error: "product_import_queue_unavailable", status: 503 };
      }
    },
  };
}
