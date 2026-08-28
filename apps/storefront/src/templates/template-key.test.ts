import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveStorefrontTemplateKey } from "./template-key.js";

describe("storefront template compatibility", () => {
  it("moves storefronts published with the retired demo template to Luvia", () => {
    assert.equal(resolveStorefrontTemplateKey("mesob@1"), "luvia@1");
  });

  it("does not turn an unknown template into a supported one", () => {
    assert.equal(resolveStorefrontTemplateKey("unknown@1"), "unknown@1");
  });
});
