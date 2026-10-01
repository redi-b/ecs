import assert from "node:assert/strict";
import test from "node:test";
import { loadWishlistProducts } from "./wishlist-products";

test("wishlist resolves current catalog cards once per handle through the tenant facade", async () => {
  const requests: Request[] = [];
  const products = await loadWishlistProducts({
    paths: ["/products/shoe", "/am/products/shoe", "/products/gone"],
    platformApiBaseUrl: "https://api.example",
    requestHost: "shop.example",
    locale: "am-ET",
    fetcher: async (input) => {
      const request = input as Request;
      requests.push(request);
      return Response.json({
        products:
          new URL(request.url).searchParams.get("handle") === "gone"
            ? []
            : [{ id: "p1", handle: "shoe", title: "Current title", variants: [] }],
      });
    },
  });
  assert.equal(products.length, 1);
  assert.equal(products[0]?.title, "Current title");
  assert.equal(requests.length, 2);
  assert.ok(
    requests.every((request) => request.headers.get("x-forwarded-host") === "shop.example"),
  );
});

test("wishlist rejects external paths and oversized batches before fetching", async () => {
  for (const paths of [
    ["https://evil.example/products/shoe"],
    Array(49).fill("/products/shoe"),
    ["/products/%2Fprivate"],
  ]) {
    await assert.rejects(
      loadWishlistProducts({
        paths,
        platformApiBaseUrl: "https://api.example",
        requestHost: "shop.example",
        fetcher: async () => {
          throw new Error("must not fetch");
        },
      }),
      /Invalid wishlist/,
    );
  }
});
