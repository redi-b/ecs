import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCentralDashboardUrl,
  sessionCanAccessShopHost,
  validateShopHost,
} from "./shop-host.js";

describe("validateShopHost", () => {
  it("allows central dashboard host without probing", async () => {
    process.env.DASHBOARD_PUBLIC_BASE_URL = "http://dashboard.lvh.me";
    const result = await validateShopHost({
      forwardedHost: "dashboard.lvh.me",
      fetcher: async () => {
        throw new Error("should not probe central host");
      },
    });
    assert.deepEqual(result, { ok: true });
  });

  it("maps platform shop_not_found", async () => {
    const result = await validateShopHost({
      forwardedHost: "missing.lvh.me",
      platformApiBaseUrl: "http://platform.test",
      fetcher: async () => Response.json({ error: "shop_not_found" }, { status: 404 }),
    });
    assert.deepEqual(result, { ok: false, error: "shop_not_found" });
  });

  it("returns tenant name when host is valid", async () => {
    const result = await validateShopHost({
      forwardedHost: "bole-style.lvh.me",
      platformApiBaseUrl: "http://platform.test",
      fetcher: async () =>
        Response.json({
          tenant: {
            id: "t1",
            name: "Bole Style",
            handle: "bole-style",
            hostname: "bole-style.lvh.me",
          },
        }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.tenant?.name, "Bole Style");
    }
  });
});

describe("sessionCanAccessShopHost", () => {
  it("returns true when access endpoint succeeds", async () => {
    const result = await sessionCanAccessShopHost({
      cookieHeader: "session=abc",
      forwardedHost: "addis-tech.lvh.me",
      platformApiBaseUrl: "http://platform.test",
      fetcher: async (url, init) => {
        assert.match(String(url), /\/platform\/merchant\/dashboard\/access$/);
        assert.equal(new Headers(init?.headers).get("cookie"), "session=abc");
        return Response.json({ ok: true }, { status: 200 });
      },
    });
    assert.equal(result, true);
  });

  it("returns false on forbidden", async () => {
    const result = await sessionCanAccessShopHost({
      cookieHeader: "session=abc",
      forwardedHost: "other.lvh.me",
      platformApiBaseUrl: "http://platform.test",
      fetcher: async () => Response.json({ error: "dashboard_forbidden" }, { status: 403 }),
    });
    assert.equal(result, false);
  });
});

describe("getCentralDashboardUrl", () => {
  it("builds an absolute central URL", () => {
    process.env.DASHBOARD_PUBLIC_BASE_URL = "https://dashboard.example.com";
    assert.equal(
      getCentralDashboardUrl("/admin/sign-in"),
      "https://dashboard.example.com/admin/sign-in",
    );
  });
});
