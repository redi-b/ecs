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
      getTenantScopedPath("/dashboard/products", "tenant_1"),
      "/dashboard/products?tenantId=tenant_1",
    );
    assert.equal(
      getTenantScopedPath("/dashboard/products?productStatus=product_created", "tenant_1"),
      "/dashboard/products?productStatus=product_created&tenantId=tenant_1",
    );
    assert.equal(getTenantScopedPath("/dashboard/products", undefined), "/dashboard/products");
  });

  it("preserves selected tenant id when redirecting from action requests", () => {
    const url = new URL("http://dashboard.local/dashboard/products");

    appendTenantRedirectParams(
      url,
      new Request("http://dashboard.local/dashboard/products/create?tenantId=tenant_1"),
    );

    assert.equal(url.toString(), "http://dashboard.local/dashboard/products?tenantId=tenant_1");
  });
});
