import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendTenantRedirectParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "./dashboard-tenant-context.js";

describe("dashboard tenant context", () => {
  it("reads tenant id from URL search params", () => {
    assert.equal(getSelectedTenantId({ tenantId: "tenant_1" }), "tenant_1");
    assert.equal(getSelectedTenantId({ tenantId: ["tenant_1", "tenant_2"] }), "tenant_1");
    assert.equal(getSelectedTenantId({ tenantId: " " }), undefined);
  });

  it("adds selected tenant id to dashboard paths", () => {
    assert.equal(
      getTenantScopedPath("/admin/products", "tenant_1"),
      "/admin/products?tenantId=tenant_1",
    );
    assert.equal(
      getTenantScopedPath("/admin/products?productStatus=product_created", "tenant_1"),
      "/admin/products?productStatus=product_created&tenantId=tenant_1",
    );
    assert.equal(getTenantScopedPath("/admin/products", undefined), "/admin/products");
  });

  it("preserves selected tenant id when redirecting from action requests", () => {
    const url = new URL("http://dashboard.local/admin/products");

    appendTenantRedirectParams(
      url,
      new Request("http://dashboard.local/admin/products/create?tenantId=tenant_1"),
    );

    assert.equal(url.toString(), "http://dashboard.local/admin/products?tenantId=tenant_1");
  });
});
