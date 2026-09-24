import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProductTaxonomy } from "./product-taxonomy-loader";

const collection = (id: string) => ({
  id,
  title: id,
  handle: id,
  createdAt: null,
  updatedAt: null,
});
const base = new URL("http://dashboard.local/list?tenantId=tenant_1");

test("loads every taxonomy page and preserves tenant context", async () => {
  const offsets: number[] = [];
  const signal = new AbortController().signal;
  const result = await loadProductTaxonomy(base, "collections", signal, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("tenantId"), "tenant_1");
    assert.equal(init?.signal, signal);
    const offset = Number(url.searchParams.get("offset"));
    offsets.push(offset);
    return Response.json({
      collections: Array.from({ length: offset === 0 ? 100 : 1 }, (_, i) =>
        collection(`col_${offset + i}`),
      ),
      count: 101,
      offset,
      limit: 100,
    });
  });
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(result.length, 101);
  assert.equal(result[100]?.id, "col_100");
  assert.equal(base.searchParams.has("offset"), false);
});

test("does not return partial options after a failed later page", async () => {
  let calls = 0;
  await assert.rejects(
    loadProductTaxonomy(base, "collections", new AbortController().signal, async () => {
      calls++;
      return calls === 1
        ? Response.json({ collections: [collection("one")], count: 2, offset: 0, limit: 1 })
        : new Response(null, { status: 503 });
    }),
  );
  assert.equal(calls, 2);
});

test("rejects malformed, stalled, duplicate and excessive result sets", async () => {
  for (const body of [
    {},
    { collections: [], count: 1, limit: 100, offset: 0 },
    { collections: [collection("one")], count: 10_001, limit: 100, offset: 0 },
    { collections: [collection("one")], count: 1, limit: 100, offset: 99 },
  ])
    await assert.rejects(
      loadProductTaxonomy(base, "collections", new AbortController().signal, async () =>
        Response.json(body),
      ),
    );
  await assert.rejects(
    loadProductTaxonomy(base, "collections", new AbortController().signal, async (input) => {
      const offset = Number(new URL(String(input)).searchParams.get("offset"));
      return Response.json({ collections: [collection("duplicate")], count: 2, limit: 1, offset });
    }),
  );
});

test("cancellation stops option loading", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    loadProductTaxonomy(base, "collections", controller.signal, async () => {
      calls++;
      return Response.json({});
    }),
  );
  assert.equal(calls, 0);
});
