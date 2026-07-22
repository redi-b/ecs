import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCatalogCache,
  applyPrivateNoStore,
  tenantCacheTags,
} from "./http-cache.js";

test("tenantCacheTags includes tenant and revision", () => {
  assert.deepEqual(
    tenantCacheTags({
      tenantId: "tenant_1",
      publishedRevisionId: "rev_1",
      templateKey: "classic@1",
    }),
    ["tenant:tenant_1", "revision:rev_1", "template:classic@1"],
  );
});

test("applyCatalogCache sets maxAge tags and swr", () => {
  const calls: unknown[] = [];
  applyCatalogCache(
    {
      set(options) {
        calls.push(options);
      },
    },
    {
      tenantId: "t1",
      publishedRevisionId: "r1",
      templateKey: "classic@1",
      maxAge: 60,
      swr: 120,
    },
  );

  assert.deepEqual(calls, [
    {
      maxAge: 60,
      swr: 120,
      tags: ["tenant:t1", "revision:r1", "template:classic@1"],
    },
  ]);
});

test("applyPrivateNoStore disables cache and sets header", () => {
  const calls: unknown[] = [];
  const headers = new Headers();
  applyPrivateNoStore(
    {
      set(options) {
        calls.push(options);
      },
    },
    { headers },
  );

  assert.deepEqual(calls, [false]);
  assert.equal(headers.get("Cache-Control"), "private, no-store");
});
