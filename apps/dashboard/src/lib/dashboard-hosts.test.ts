import assert from "node:assert/strict";
import test from "node:test";
import { isCentralDashboardHost } from "./dashboard-hosts.js";

test("central dashboard host isolation accepts only the configured central host", () => {
  const previous = process.env.DASHBOARD_PUBLIC_BASE_URL;
  process.env.DASHBOARD_PUBLIC_BASE_URL = "https://dashboard.example.com";
  try {
    assert.equal(isCentralDashboardHost("dashboard.example.com"), true);
    assert.equal(isCentralDashboardHost("DASHBOARD.EXAMPLE.COM:443"), true);
    assert.equal(isCentralDashboardHost("merchant.dashboard.example.com"), false);
    assert.equal(isCentralDashboardHost("dashboard.example.com.evil.test"), false);
  } finally {
    if (previous === undefined) delete process.env.DASHBOARD_PUBLIC_BASE_URL;
    else process.env.DASHBOARD_PUBLIC_BASE_URL = previous;
  }
});
