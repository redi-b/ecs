import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublishedStorefrontConfig } from "@ecs/contracts";

import { getStorefrontPublicOrigin } from "./seo-origin.js";

describe("storefront public origin", () => {
  it("uses the trusted primary domain instead of the currently requested alias", () => {
    assert.equal(getStorefrontPublicOrigin(config(), "https"), "https://shop.example.com");
  });

  it("uses HTTP for local storefront domains unless explicitly configured", () => {
    assert.equal(
      getStorefrontPublicOrigin(config("abebe.lvh.me"), undefined),
      "http://abebe.lvh.me",
    );
  });

  it("rejects a malformed hostname even when it came through the config boundary", () => {
    assert.throws(
      () => getStorefrontPublicOrigin(config("evil.example/path"), "https"),
      /invalid_storefront_primary_hostname/,
    );
  });

  it("fails closed on an unsupported configured public scheme", () => {
    assert.throws(
      () => getStorefrontPublicOrigin(config(), "ftp"),
      /invalid_storefront_public_scheme/,
    );
  });
});

function config(primaryHostname = "Shop.Example.com."): PublishedStorefrontConfig {
  return {
    tenant: {
      id: "tenant_1",
      name: "Abebe Market",
      handle: "abebe",
      status: "active",
      domain: { id: "domain_alias", hostname: "alias.example.com" },
      primaryDomain: { hostname: primaryHostname },
    },
    commerce: { regionId: "reg_1" },
    storefront: {
      seo: { title: null, description: null, socialImageUrl: null },
      publishedRevisionId: "revision_1",
      templateId: "template_1",
      templateVersion: 1,
      templateKey: "luvia@1",
      data: {},
      themeTokens: {},
      publishedAt: "2026-08-25T00:00:00.000Z",
    },
  };
}
