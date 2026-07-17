import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSharedParentCookieDomain } from "./shared-cookie-domain.js";

describe("getSharedParentCookieDomain", () => {
  it("prefers DASHBOARD_AUTH_COOKIE_DOMAIN", () => {
    assert.equal(
      getSharedParentCookieDomain({
        authCookieDomain: ".ecs.example.com",
        hostname: "dashboard.ecs.example.com",
      }),
      ".ecs.example.com",
    );
  });

  it("drops leftmost label for multi-level base domains", () => {
    assert.equal(
      getSharedParentCookieDomain({
        authCookieDomain: null,
        dashboardPublicBaseUrl: "https://dashboard.ecs.eclipticcreative.com",
        hostname: "bole-style.ecs.eclipticcreative.com",
      }),
      ".ecs.eclipticcreative.com",
    );
  });

  it("maps lvh.me shop hosts to .lvh.me", () => {
    assert.equal(
      getSharedParentCookieDomain({
        authCookieDomain: null,
        dashboardPublicBaseUrl: null,
        hostname: "addis-tech.lvh.me",
      }),
      ".lvh.me",
    );
  });

  it("returns null for localhost", () => {
    assert.equal(
      getSharedParentCookieDomain({
        authCookieDomain: null,
        dashboardPublicBaseUrl: null,
        hostname: "localhost",
      }),
      null,
    );
  });
});
