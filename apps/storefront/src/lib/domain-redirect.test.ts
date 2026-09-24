import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPrimaryDomainRedirect } from "./domain-redirect.js";

describe("primary domain redirects", () => {
  it("redirects a secondary custom hostname and preserves path/query", () => {
    const redirect = getPrimaryDomainRedirect({
      method: "GET",
      platformBaseDomain: "shops.ecs.example",
      primaryHostname: "shop.example.com",
      requestUrl: new URL("https://old.example.com/products/coffee?size=large"),
    });
    assert.equal(redirect?.href, "https://shop.example.com/products/coffee?size=large");
  });

  it("keeps the managed platform hostname available as a fallback", () => {
    const redirect = getPrimaryDomainRedirect({
      method: "GET",
      platformBaseDomain: "shops.ecs.example",
      primaryHostname: "shop.example.com",
      requestUrl: new URL("https://abebe.shops.ecs.example/products"),
    });
    assert.equal(redirect, null);
  });

  it("never redirects mutations", () => {
    const redirect = getPrimaryDomainRedirect({
      method: "POST",
      platformBaseDomain: "shops.ecs.example",
      primaryHostname: "shop.example.com",
      requestUrl: new URL("https://old.example.com/actions/cart/update"),
    });
    assert.equal(redirect, null);
  });
});
