import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDashboardAuthRedirectPath,
  getMerchantDashboardAccess,
  getSafeDashboardPath,
} from "./dashboard-auth.js";

const accessPayload = {
  actor: {
    email: "owner@abebe.local",
    id: "user_1",
    name: "Abebe Owner",
    role: "owner" as const,
  },
  commerce: {
    hasPublishableKey: true,
    hasSalesChannel: true,
    hasStore: true,
  },
  domain: {
    hostname: "abebe.lvh.me",
    id: "domain_1",
  },
  storefront: {
    isPublished: true,
    publishedRevisionId: "revision_1",
    templateId: "template_1",
    templateKey: "classic@1",
    templateVersion: 1,
  },
  tenant: {
    handle: "abebe",
    id: "tenant_1",
    name: "Abebe Market",
    status: "active" as const,
  },
};

describe("getSafeDashboardPath", () => {
  it("keeps safe admin paths with query strings", () => {
    assert.equal(getSafeDashboardPath("/admin/products?page=2"), "/admin/products?page=2");
  });

  it("rejects external and non-admin paths", () => {
    assert.equal(getSafeDashboardPath("https://evil.test/admin"), "/admin");
    assert.equal(getSafeDashboardPath("//evil.test/admin"), "/admin");
    assert.equal(getSafeDashboardPath("/admin/../store"), "/admin");
    assert.equal(getSafeDashboardPath("/admin/%2e%2e/store"), "/admin");
    assert.equal(getSafeDashboardPath("/store"), "/admin");
    assert.equal(getSafeDashboardPath(""), "/admin");
  });
});

describe("getDashboardAuthRedirectPath", () => {
  it("builds a sign-in path with a safe next value", () => {
    assert.equal(
      getDashboardAuthRedirectPath("/admin/orders?page=2"),
      "/admin/sign-in?next=%2Fadmin%2Forders%3Fpage%3D2",
    );
  });
});

describe("getMerchantDashboardAccess", () => {
  it("returns lean access for an authenticated merchant", async () => {
    const access = await getMerchantDashboardAccess({
      getAccess: async () => ({ ok: true, access: accessPayload }),
    });

    assert.deepEqual(access, {
      ok: true,
      access: accessPayload,
    });
  });

  it("maps auth_required to unauthenticated", async () => {
    const access = await getMerchantDashboardAccess({
      getAccess: async () => ({
        ok: false,
        message: "auth_required",
        status: 401,
      }),
    });

    assert.deepEqual(access, {
      kind: "unauthenticated",
      ok: false,
    });
  });

  it("maps dashboard_forbidden to forbidden", async () => {
    const access = await getMerchantDashboardAccess({
      getAccess: async () => ({
        ok: false,
        message: "dashboard_forbidden",
        status: 403,
      }),
    });

    assert.deepEqual(access, {
      kind: "forbidden",
      message: "dashboard_forbidden",
      ok: false,
    });
  });

  it("maps network failures to unavailable", async () => {
    const access = await getMerchantDashboardAccess({
      getAccess: async () => ({
        ok: false,
        message: "platform_request_failed",
        status: 503,
      }),
    });

    assert.deepEqual(access, {
      kind: "unavailable",
      message: "platform_request_failed",
      ok: false,
    });
  });

  it("maps shop_not_found to shop_not_found", async () => {
    const access = await getMerchantDashboardAccess({
      getAccess: async () => ({
        ok: false,
        message: "shop_not_found",
        status: 404,
      }),
    });

    assert.deepEqual(access, {
      kind: "shop_not_found",
      ok: false,
    });
  });
});
