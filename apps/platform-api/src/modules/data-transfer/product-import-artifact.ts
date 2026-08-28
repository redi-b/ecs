import { createHash } from "node:crypto";
import type { createPlatformDb } from "@ecs/db";
import { auditLogs, productImportArtifacts } from "@ecs/db";

import { PRODUCT_CSV_SCHEMA_VERSION } from "./product-export.js";
import type { ProductImportDryRun } from "./product-import-dry-run.js";
import type { ProductImportWrite } from "./product-import-plan.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const DEFAULT_ARTIFACT_TTL_MS = 30 * 60 * 1000;

export type ProductImportArtifactSummary = {
  blocked: number;
  creates: number;
  products: number;
  rows: number;
  updates: number;
};

export type ReviewedProductImportArtifact = {
  contentDigest: string;
  expiresAt: string;
  id: string;
  schemaVersion: string;
  status: "reviewed";
  summary: ProductImportArtifactSummary;
};

export function productImportContentDigest(csv: string) {
  return createHash("sha256").update(csv, "utf8").digest("hex");
}

export function createProductImportArtifactService(
  db: PlatformDb,
  options: { artifactTtlMs?: number; now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());
  const artifactTtlMs = options.artifactTtlMs ?? DEFAULT_ARTIFACT_TTL_MS;

  return {
    createReviewedArtifact: async (input: {
      csv: string;
      dryRun: ProductImportDryRun;
      tenantId: string;
      userId: string;
      writes: ProductImportWrite[];
    }): Promise<ReviewedProductImportArtifact> => {
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + artifactTtlMs);
      const contentDigest = productImportContentDigest(input.csv);
      const summary: ProductImportArtifactSummary = {
        ...input.dryRun.summary,
        products: input.writes.length,
      };

      const artifact = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(productImportArtifacts)
          .values({
            tenantId: input.tenantId,
            createdByUserId: input.userId,
            schemaVersion: PRODUCT_CSV_SCHEMA_VERSION,
            contentDigest,
            csv: input.csv,
            writePlan: input.writes,
            summary,
            status: "reviewed",
            expiresAt,
            createdAt,
          })
          .returning({ id: productImportArtifacts.id });
        if (!row) throw new Error("Product import artifact insert returned no rows.");

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "product_import.reviewed",
          targetType: "product_import_artifact",
          targetId: row.id,
          metadata: { contentDigest, expiresAt: expiresAt.toISOString(), summary },
        });
        return row;
      });

      return {
        contentDigest,
        expiresAt: expiresAt.toISOString(),
        id: artifact.id,
        schemaVersion: PRODUCT_CSV_SCHEMA_VERSION,
        status: "reviewed",
        summary,
      };
    },
  };
}
