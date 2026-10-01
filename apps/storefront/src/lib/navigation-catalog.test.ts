import assert from "node:assert/strict";
import test from "node:test";
import { loadNavigationCatalog } from "./navigation-catalog";

test("public shell navigation is independent of page merchandising and scoped to host/locale", async () => {
  const requests: Request[] = [];
  const request = new Request("https://bole.example/contact", {
    headers: { host: "bole.example" },
  });
  const result = await loadNavigationCatalog(request, {
    categories: [],
    collections: [],
    platformApiBaseUrl: "https://api.example",
    locale: "am-ET",
    fetcher: async (input) => {
      const req = input as Request;
      requests.push(req);
      return req.url.includes("product-categories")
        ? Response.json({ product_categories: [{ id: "cat_1", name: "Beauty", handle: "beauty" }] })
        : Response.json({ collections: [{ id: "col_1", title: "New", handle: "new" }] });
    },
  });
  assert.equal(result.categories[0]?.handle, "beauty");
  assert.equal(result.collections[0]?.handle, "new");
  assert.equal(requests.length, 2);
  for (const req of requests) {
    assert.equal(req.headers.get("x-forwarded-host"), "bole.example");
    assert.equal(req.headers.get("x-medusa-locale"), "am-ET");
  }
});

test("demo and signed editor navigation use supplied fixtures without public catalog requests", async () => {
  for (const mode of [{ demoMode: true }, { editorMode: true }]) {
    const categories = [
      { id: "preview", name: "Preview", handle: "preview", parentCategoryId: null, mediaUrl: null },
    ];
    const result = await loadNavigationCatalog(new Request("https://example/preview"), {
      ...mode,
      categories,
      fetcher: async () => {
        throw new Error("Unexpected network");
      },
    });
    assert.deepEqual(result.categories, categories);
  }
});

test("navigation caches only within one request and degrades safely on transport failure", async () => {
  let calls = 0;
  const options = {
    platformApiBaseUrl: "https://api.example",
    fetcher: async () => { calls++; throw new Error("network unavailable"); },
  };
  const request = new Request("https://shop.example/contact");
  const results = await Promise.all([loadNavigationCatalog(request, options), loadNavigationCatalog(request, options)]);
  assert.deepEqual(results[0], { categories: [], collections: [] });
  assert.equal(calls, 2);
  await loadNavigationCatalog(new Request("https://other.example/contact"), options);
  assert.equal(calls, 4);
});
