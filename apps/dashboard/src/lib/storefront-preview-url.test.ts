import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStorefrontPreviewUrl,
  isMixedContentPreviewUrl,
  resolvePublicStorefrontProtocol,
} from "./storefront-preview-url.js";

describe("storefront preview URLs", () => {
  it("uses the trusted proxy protocol for deployed storefront hosts", () => {
    const protocol = resolvePublicStorefrontProtocol({
      forwardedProtocol: "https",
      hostname: "bole-style.ecs.eclipticcreative.com",
      nodeEnv: "production",
    });
    assert.equal(protocol, "https");
    assert.equal(
      buildStorefrontPreviewUrl({ hostname: "bole-style.ecs.eclipticcreative.com", protocol, token: "signed" }),
      "https://bole-style.ecs.eclipticcreative.com/preview?token=signed",
    );
  });

  it("keeps local lvh.me development on http", () => {
    assert.equal(
      resolvePublicStorefrontProtocol({ hostname: "bole-style.lvh.me", nodeEnv: "development" }),
      "http",
    );
  });

  it("identifies a mixed-content preview before the iframe is mounted", () => {
    assert.equal(isMixedContentPreviewUrl("http://shop.example.com/preview", "https:"), true);
    assert.equal(isMixedContentPreviewUrl("https://shop.example.com/preview", "https:"), false);
  });
});
