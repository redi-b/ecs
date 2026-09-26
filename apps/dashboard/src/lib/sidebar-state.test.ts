import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSidebarDefaultOpen, isStorefrontEditorPath } from "./sidebar-state.js";

describe("isStorefrontEditorPath", () => {
  it("identifies storefront editor routes", () => {
    assert.equal(isStorefrontEditorPath("/dashboard/editor"), true);
    assert.equal(isStorefrontEditorPath("/dashboard/editor/"), true);
    assert.equal(isStorefrontEditorPath("/dashboard/editor?tenantId=shop_1"), true);
    assert.equal(isStorefrontEditorPath("/dashboard/editor#section"), true);
  });

  it("rejects non-editor routes", () => {
    assert.equal(isStorefrontEditorPath(undefined), false);
    assert.equal(isStorefrontEditorPath(null), false);
    assert.equal(isStorefrontEditorPath(""), false);
    assert.equal(isStorefrontEditorPath("/dashboard"), false);
    assert.equal(isStorefrontEditorPath("/dashboard/products"), false);
    assert.equal(isStorefrontEditorPath("/dashboard/settings"), false);
  });
});

describe("getSidebarDefaultOpen", () => {
  it("starts collapsed when the shadcn sidebar cookie is false", () => {
    assert.equal(getSidebarDefaultOpen("false"), false);
    assert.equal(getSidebarDefaultOpen("false", "/dashboard"), false);
  });

  it("starts collapsed on the storefront editor route regardless of cookie value", () => {
    assert.equal(getSidebarDefaultOpen(undefined, "/dashboard/editor"), false);
    assert.equal(getSidebarDefaultOpen("true", "/dashboard/editor"), false);
    assert.equal(getSidebarDefaultOpen("true", "/dashboard/editor?tenantId=shop_1"), false);
  });

  it("starts expanded for missing or non-false cookie values on standard routes", () => {
    assert.equal(getSidebarDefaultOpen(undefined), true);
    assert.equal(getSidebarDefaultOpen(undefined, "/dashboard"), true);
    assert.equal(getSidebarDefaultOpen("true"), true);
    assert.equal(getSidebarDefaultOpen("true", "/dashboard/products"), true);
    assert.equal(getSidebarDefaultOpen("unexpected"), true);
  });
});
