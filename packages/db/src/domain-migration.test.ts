import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createPlatformDb } from "./client.js";

test(
  "domain grace migration applies and reapplies in an isolated local database",
  {
    skip: process.env.ECS_DOMAIN_MIGRATION_TEST !== "1",
    timeout: 60_000,
  },
  async (t) => {
    const adminUrl = new URL(
      process.env.PLATFORM_DOMAIN_TEST_ADMIN_URL ?? "postgres://ecs:ecs@localhost:5432/postgres",
    );
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(adminUrl.hostname)) {
      throw new Error("Domain migration test requires an explicit local PostgreSQL server.");
    }
    const name = `ecs_domain_test_${randomUUID().replaceAll("-", "")}`;
    const admin = createPlatformDb({ connectionString: adminUrl.toString(), max: 1 });
    let created = false;
    let isolated: ReturnType<typeof createPlatformDb> | undefined;
    t.after(async () => {
      await isolated?.pool.end();
      try {
        if (created) await admin.pool.query(`DROP DATABASE "${name}"`);
      } finally {
        await admin.pool.end();
      }
    });
    await admin.pool.query(`CREATE DATABASE "${name}"`);
    created = true;
    const testUrl = new URL(adminUrl);
    testUrl.pathname = `/${name}`;
    isolated = createPlatformDb({ connectionString: testUrl.toString(), max: 1 });
    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    await migrate(isolated.db, { migrationsFolder });
    await migrate(isolated.db, { migrationsFolder });
    const columns = await isolated.pool.query<{ column_name: string; is_nullable: string }>(
      "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='domains' AND column_name IN ('activated_at','warning_since','warning_reason') ORDER BY column_name",
    );
    assert.deepEqual(columns.rows, [
      { column_name: "activated_at", is_nullable: "YES" },
      { column_name: "warning_reason", is_nullable: "YES" },
      { column_name: "warning_since", is_nullable: "YES" },
    ]);
  },
);
