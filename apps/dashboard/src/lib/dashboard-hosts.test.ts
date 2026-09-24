import assert from "node:assert/strict";
import test from "node:test";
import {
  getDashboardPublicUrl,
  isCentralDashboardHost,
  isLegacyCentralDashboardHost,
} from "./dashboard-hosts.js";

test("central dashboard host isolation accepts only the configured central host", () => {
  const previous = process.env.DASHBOARD_PUBLIC_BASE_URL;
  process.env.DASHBOARD_PUBLIC_BASE_URL = "https://app.example.com";
  try {
    assert.equal(isCentralDashboardHost("app.example.com"), true);
    assert.equal(isCentralDashboardHost("APP.EXAMPLE.COM:443"), true);
    assert.equal(isCentralDashboardHost("merchant.app.example.com"), false);
    assert.equal(isCentralDashboardHost("app.example.com.evil.test"), false);
  } finally {
    if (previous === undefined) delete process.env.DASHBOARD_PUBLIC_BASE_URL;
    else process.env.DASHBOARD_PUBLIC_BASE_URL = previous;
  }
});

test("legacy dashboard host is isolated from the canonical app host", () => {
  const previousCanonical = process.env.DASHBOARD_PUBLIC_BASE_URL;
  const previousLegacy = process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL;
  process.env.DASHBOARD_PUBLIC_BASE_URL = "https://app.example.com";
  process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL = "https://dashboard.example.com";
  try {
    assert.equal(getDashboardPublicUrl().href, "https://app.example.com/");
    assert.equal(isLegacyCentralDashboardHost("dashboard.example.com"), true);
    assert.equal(isLegacyCentralDashboardHost("app.example.com"), false);
  } finally {
    if (previousCanonical === undefined) delete process.env.DASHBOARD_PUBLIC_BASE_URL;
    else process.env.DASHBOARD_PUBLIC_BASE_URL = previousCanonical;
    if (previousLegacy === undefined) delete process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL;
    else process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL = previousLegacy;
  }
});
