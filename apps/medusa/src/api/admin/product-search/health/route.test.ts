import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "./route";

test("product search health reports an available populated index", async () => {
  let responseStatus = 0;
  let body: unknown;
  await GET({
    scope: { resolve: () => ({ status: async () => ({ available: true, documentCount: 24 }) }) },
  } as any, {
    status: (status: number) => {
      responseStatus = status;
      return { json: (value: unknown) => { body = value; } };
    },
  } as any);
  assert.equal(responseStatus, 200);
  assert.deepEqual(body, { available: true, document_count: 24, populated: true });
});

test("product search health fails when index state cannot be read", async () => {
  let responseStatus = 0;
  let body: unknown;
  await GET({
    scope: { resolve: () => ({ status: async () => ({ available: false, documentCount: null }) }) },
  } as any, {
    status: (status: number) => {
      responseStatus = status;
      return { json: (value: unknown) => { body = value; } };
    },
  } as any);
  assert.equal(responseStatus, 503);
  assert.deepEqual(body, { available: false, document_count: null, populated: false });
});
