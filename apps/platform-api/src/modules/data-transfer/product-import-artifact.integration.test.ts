import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditLogs, createPlatformDb, productImportArtifacts, tenants } from "@ecs/db";
import { and, eq } from "drizzle-orm";

import { createProductImportArtifactService } from "./product-import-artifact.js";

const connectionString = process.env.PLATFORM_IMPORT_INTEGRATION_DATABASE_URL?.trim();

describe("product import artifact PostgreSQL boundary", () => {
  it(
    "persists the exact reviewed input and audit event under one tenant",
    { skip: !connectionString && "PLATFORM_IMPORT_INTEGRATION_DATABASE_URL is not set" },
    async () => {
      if (!connectionString) return;
      const platform = createPlatformDb({ connectionString, max: 1 });
      let artifactId: string | undefined;
      try {
        const [tenant] = await platform.db.select({ id: tenants.id }).from(tenants).limit(1);
        assert.ok(tenant, "integration database needs one migrated tenant");
        const service = createProductImportArtifactService(platform.db, {
          now: () => new Date("2026-08-25T12:00:00.000Z"),
        });
        const csv = "schema_version,product_title\necs-products-v1,ቡና\n";
        const artifact = await service.createReviewedArtifact({
          csv,
          dryRun: {
            issues: [],
            plans: [],
            summary: { blocked: 0, creates: 1, rows: 1, updates: 0 },
          },
          tenantId: tenant.id,
          userId: "product_import_integration_test",
          writes: [
            {
              action: "create",
              categoryIds: [],
              collectionId: null,
              description: null,
              handle: "buna-integration-test",
              imageUrls: [],
              productId: null,
              sourceRows: [2],
              status: "draft",
              thumbnail: null,
              title: "ቡና",
              variants: [],
            },
          ],
        });
        artifactId = artifact.id;

        const [stored] = await platform.db
          .select()
          .from(productImportArtifacts)
          .where(
            and(
              eq(productImportArtifacts.id, artifact.id),
              eq(productImportArtifacts.tenantId, tenant.id),
            ),
          )
          .limit(1);
        assert.equal(stored?.csv, csv);
        assert.equal(stored?.contentDigest, artifact.contentDigest);
        assert.deepEqual(stored?.summary, artifact.summary);
        assert.equal(stored?.expiresAt.toISOString(), "2026-08-25T12:30:00.000Z");

        const [audit] = await platform.db
          .select({ action: auditLogs.action, targetId: auditLogs.targetId })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.action, "product_import.reviewed"),
              eq(auditLogs.targetId, artifact.id),
            ),
          )
          .limit(1);
        assert.deepEqual(audit, { action: "product_import.reviewed", targetId: artifact.id });
      } finally {
        if (artifactId) {
          await platform.db.delete(auditLogs).where(eq(auditLogs.targetId, artifactId));
          await platform.db
            .delete(productImportArtifacts)
            .where(eq(productImportArtifacts.id, artifactId));
        }
        await platform.pool.end();
      }
    },
  );
});
