import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeStorefrontMediaUrl } from "./media-url.js";

describe("storefront media URL boundary", () => {
  const base = "https://media.example.com/ecs-media";

  it("accepts same-storefront paths and owned media objects", () => {
    assert.equal(normalizeStorefrontMediaUrl("/images/logo.svg", base), "/images/logo.svg");
    assert.equal(
      normalizeStorefrontMediaUrl("https://media.example.com/ecs-media/tenants/t1/a.jpg", base),
      "https://media.example.com/ecs-media/tenants/t1/a.jpg",
    );
  });

  it("rejects sibling paths, lookalike hosts, credentials, and non-HTTP schemes", () => {
    assert.equal(
      normalizeStorefrontMediaUrl("https://media.example.com/private/a.jpg", base),
      null,
    );
    assert.equal(
      normalizeStorefrontMediaUrl("https://media.example.com.evil.test/ecs-media/a.jpg", base),
      null,
    );
    assert.equal(normalizeStorefrontMediaUrl("javascript:alert(1)", base), null);
    assert.equal(normalizeStorefrontMediaUrl("//evil.test/a.jpg", base), null);
  });

  it("fails closed for absolute media when the trusted base is absent or invalid", () => {
    assert.equal(normalizeStorefrontMediaUrl("https://media.example.com/a.jpg", undefined), null);
    assert.equal(normalizeStorefrontMediaUrl("https://media.example.com/a.jpg", "not-a-url"), null);
  });

  it("accepts the local ECS media origin during development without weakening production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        normalizeStorefrontMediaUrl("http://localhost:9002/ecs-media/tenants/t1/product/image.jpg"),
        "http://localhost:9002/ecs-media/tenants/t1/product/image.jpg",
      );
      assert.equal(normalizeStorefrontMediaUrl("https://example.com/image.jpg"), null);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
});
