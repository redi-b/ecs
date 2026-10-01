import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createPlatformDb,
  domainLifecycleEvents,
  domains,
  domainVerificationChallenges,
  emailTemplateVersions,
  organizations,
  platformAssets,
  platformPermissionGrants,
  platformPrincipals,
  tenantMemberships,
  tenants,
  users,
} from "@ecs/db";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDemoCleanup } from "./demo-cleanup.js";
import type { createDemoMedusaClient } from "./demo-medusa-client.js";
import { DEMO_OPERATIONS, demoShops } from "./demo-shops.js";

const connectionString = process.env.ECS_UNSEED_TEST_DATABASE_URL;
const databaseTest = {
  skip: !connectionString && "Set ECS_UNSEED_TEST_DATABASE_URL to an isolated regression database",
};
const medusa = {
  get: async () => ({}),
  delete: async () => {
    throw new Error("No commerce fixtures should be deleted");
  },
  post: async () => {
    throw new Error("No commerce fixtures should be mutated");
  },
} as unknown as ReturnType<typeof createDemoMedusaClient>;

async function withDatabase(run: (db: ReturnType<typeof createPlatformDb>["db"]) => Promise<void>) {
  assert.ok(connectionString);
  assert.equal(
    new URL(connectionString).pathname,
    "/ecs_unseed_regression",
    "Never run cleanup fixtures against an application database",
  );
  const { db, pool } = createPlatformDb({ connectionString });
  const rollback = new Error("Rollback isolated fixtures");
  try {
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../packages/db/migrations", import.meta.url),
      ),
    });
    try {
      await db.transaction(async (tx) => {
        await run(tx as unknown as typeof db);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  } finally {
    await pool.end();
  }
}

test(
  "unseed preserves shared platform assets while removing their demo creator",
  databaseTest,
  async () => {
    await withDatabase(async (db) => {
      await db.insert(users).values({
        id: DEMO_OPERATIONS.operator.id,
        name: "Demo operator",
        email: DEMO_OPERATIONS.operator.email,
      });
      const [asset] = await db
        .insert(platformAssets)
        .values({
          storageProvider: "s3",
          bucket: "regression",
          objectKey: "shared-preview",
          filename: "preview.png",
          mimeType: "image/png",
          byteSize: 10,
          createdByUserId: DEMO_OPERATIONS.operator.id,
        })
        .returning();
      assert.ok(asset);
      await db
        .insert(platformPrincipals)
        .values({ id: DEMO_OPERATIONS.principalId, userId: DEMO_OPERATIONS.operator.id });
      await db.insert(platformPermissionGrants).values({
        principalId: DEMO_OPERATIONS.principalId,
        permission: "regression",
        grantedByUserId: DEMO_OPERATIONS.operator.id,
      });
      await db.insert(emailTemplateVersions).values({
        templateKey: "regression",
        locale: "en",
        version: 1,
        subject: "Shared published content",
        content: {},
        senderProfile: "platform",
        publishedByPrincipalId: DEMO_OPERATIONS.principalId,
      });
      // Only the external Medusa HTTP boundary is stubbed. PostgreSQL and cleanup are real.
      const cleanup = createDemoCleanup({ db, medusa });
      await cleanup.cleanAllDemoData();
      assert.equal((await db.select().from(users)).length, 0);
      const retained = await db.select().from(platformAssets);
      assert.equal(retained.length, 1);
      assert.equal(retained[0]?.id, asset.id);
      assert.equal(retained[0]?.createdByUserId, null);
      assert.equal((await db.select().from(platformPermissionGrants)).length, 0);
      assert.equal((await db.select().from(platformPrincipals)).length, 0);
      const published = await db.select().from(emailTemplateVersions);
      assert.equal(published.length, 1);
      assert.equal(published[0]?.publishedByPrincipalId, null);
      await cleanup.cleanAllDemoData();
      assert.equal((await db.select().from(platformAssets)).length, 1);
    });
  },
);

test(
  "unseed discovers nested and newly deployed tenant FKs while preserving another tenant",
  databaseTest,
  async () => {
    await withDatabase(async (db) => {
      const demoId = demoShops[0].ids.tenant;
      const otherId = "f0000000-0000-4000-8000-000000000001";
      await db.insert(organizations).values([
        { id: "regression-demo", name: "Demo", slug: "regression-demo" },
        { id: "regression-real", name: "Real", slug: "regression-real" },
      ]);
      await db.insert(tenants).values([
        {
          id: demoId,
          organizationId: "regression-demo",
          name: "Demo",
          handle: demoShops[0].tenant.handle,
        },
        { id: otherId, organizationId: "regression-real", name: "Real", handle: "regression-real" },
      ]);
      const [domain] = await db
        .insert(domains)
        .values({
          tenantId: demoId,
          hostname: "demo.regression.test",
          type: "custom",
          status: "pending_verification",
        })
        .returning();
      assert.ok(domain);
      await db.insert(domainVerificationChallenges).values({
        domainId: domain.id,
        recordName: "_ecs",
        recordValue: "test",
        expiresAt: new Date(Date.now() + 60000),
      });
      await db
        .insert(domainLifecycleEvents)
        .values({ domainId: domain.id, tenantId: demoId, event: "test" });
      // Not in Drizzle's exports: proves new deployed dependents need no seed deletion-list edit.
      await db.execute(sql`create table public.demo_cleanup_regression_extension (
      id text primary key, tenant_id uuid not null references public.tenants(id))`);
      await db.execute(sql`insert into public.demo_cleanup_regression_extension values
      ('demo', ${demoId}::uuid), ('real', ${otherId}::uuid)`);
      const cleanup = createDemoCleanup({ db, medusa });
      await cleanup.cleanAllDemoData();
      assert.deepEqual(
        (await db.select().from(tenants)).map((row) => row.id),
        [otherId],
      );
      assert.equal((await db.select().from(domainVerificationChallenges)).length, 0);
      assert.equal((await db.select().from(domainLifecycleEvents)).length, 0);
      assert.deepEqual(
        (
          await db.execute<{ id: string }>(
            sql`select id from public.demo_cleanup_regression_extension`,
          )
        ).rows,
        [{ id: "real" }],
      );
      await cleanup.cleanAllDemoData();
      assert.equal((await db.select().from(tenants)).length, 1);
    });
  },
);

test(
  "unseed refuses cross-tenant user references and rolls back earlier platform deletes",
  databaseTest,
  async () => {
    await withDatabase(async (db) => {
      const demoId = demoShops[0].ids.tenant;
      const otherId = "f0000000-0000-4000-8000-000000000001";
      await db.insert(users).values({
        id: DEMO_OPERATIONS.operator.id,
        name: "Demo operator",
        email: DEMO_OPERATIONS.operator.email,
      });
      await db.insert(organizations).values([
        { id: "regression-demo", name: "Demo", slug: "regression-demo" },
        { id: "regression-real", name: "Real", slug: "regression-real" },
      ]);
      await db.insert(tenants).values([
        {
          id: demoId,
          organizationId: "regression-demo",
          name: "Demo",
          handle: demoShops[0].tenant.handle,
        },
        { id: otherId, organizationId: "regression-real", name: "Real", handle: "regression-real" },
      ]);
      await db
        .insert(tenantMemberships)
        .values({ tenantId: otherId, userId: DEMO_OPERATIONS.operator.id, role: "owner" });
      await assert.rejects(
        createDemoCleanup({ db, medusa }).cleanAllDemoData(),
        /refused unrelated data/,
      );
      assert.equal((await db.select().from(tenants)).length, 2);
      assert.equal((await db.select().from(organizations)).length, 2);
      assert.equal(
        (await db.select().from(users).where(eq(users.id, DEMO_OPERATIONS.operator.id))).length,
        1,
      );
      assert.equal((await db.select().from(tenantMemberships)).length, 1);
    });
  },
);
