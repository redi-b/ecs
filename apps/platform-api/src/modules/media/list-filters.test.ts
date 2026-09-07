import assert from "node:assert/strict";
import { test } from "node:test";
import { drizzle } from "drizzle-orm/pg-proxy";
import { createMediaService } from "./service.js";

test("media data and count use the same tenant, ready/public, search and dimension predicates", async () => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [] };
  });
  const service = createMediaService(
    db as unknown as Parameters<typeof createMediaService>[0],
    {} as Parameters<typeof createMediaService>[1],
  );
  await service.listMedia({
    tenantId: "tenant_one",
    publicOnly: true,
    mimeType: "image/",
    query: "50%_off",
    orientation: "portrait",
    size: "medium",
    sort: "name_asc",
    limit: 24,
    offset: 120,
  });
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.ok(query.params.includes("tenant_one"));
    assert.ok(query.params.includes("ready"));
    assert.ok(query.params.includes("public"));
    assert.ok(query.params.includes("%50\\%\\_off%"));
    assert.ok(query.params.includes(100 * 1024));
    assert.ok(query.params.includes(1024 * 1024));
    assert.match(query.sql, /"width" < .*"height"/);
  }
  const page = queries.find((query) => query.sql.includes("limit"))!;
  assert.match(page.sql, /order by .*"display_name" asc, .*"id" asc/);
  assert.ok(page.params.includes(24));
  assert.ok(page.params.includes(120));
});
