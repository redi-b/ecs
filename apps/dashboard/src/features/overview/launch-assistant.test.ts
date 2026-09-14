import assert from "node:assert/strict";
import test from "node:test";
import type { MerchantDashboardAccess } from "@ecs/contracts";

import { getLaunchChecklistItems } from "./launch-assistant-model.js";

const access: MerchantDashboardAccess = {
  actor: {
    id: "user_1",
    email: "owner@example.com",
    name: "Owner",
    role: "owner",
  },
  commerce: {
    hasPublishableKey: true,
    hasSalesChannel: true,
    hasStore: true,
  },
  domain: {
    id: "domain_1",
    hostname: "shop.example.com",
  },
  storefront: {
    isPublished: false,
    publishedRevisionId: null,
    templateId: "template_1",
    templateKey: "nexahub",
    templateVersion: 1,
  },
  tenant: {
    id: "tenant_1",
    name: "Shop",
    handle: "shop",
    status: "active",
  },
};

const translate = (key: string) => key;

test("orders the real launch path and does not invent optional completion", () => {
  const items = getLaunchChecklistItems(
    { ...access, hasVisitedEditor: false, productCount: 0 },
    translate as Parameters<typeof getLaunchChecklistItems>[1],
  );

  assert.deepEqual(
    items.map((item) => item.id),
    ["profile", "design", "catalog", "publish", "fulfillment", "payments"],
  );
  assert.equal(items.find((item) => item.id === "design")?.current, true);
  assert.equal(items.find((item) => item.id === "fulfillment")?.ready, false);
  assert.equal(items.find((item) => item.id === "payments")?.ready, false);
});

test("points a configured storefront directly to the editor", () => {
  const design = getLaunchChecklistItems(
    { ...access, hasVisitedEditor: true, productCount: 1 },
    translate as Parameters<typeof getLaunchChecklistItems>[1],
  ).find((item) => item.id === "design");

  assert.equal(design?.ready, true);
  assert.equal(design?.href, "/admin/editor");
});

test("does not complete storefront review from template selection alone", () => {
  const design = getLaunchChecklistItems(
    { ...access, hasVisitedEditor: false, productCount: 1 },
    translate as Parameters<typeof getLaunchChecklistItems>[1],
  ).find((item) => item.id === "design");

  assert.equal(design?.ready, false);
  assert.equal(design?.current, true);
});

test("keeps the setup path visible while the product count is loading", () => {
  const catalog = getLaunchChecklistItems(
    { ...access, hasVisitedEditor: true, productCount: null },
    translate as Parameters<typeof getLaunchChecklistItems>[1],
  ).find((item) => item.id === "catalog");

  assert.equal(catalog?.ready, false);
  assert.equal(catalog?.description, "overview.launch.catalogChecking");
});

test("keeps the setup path useful when the product count cannot be loaded", () => {
  const catalog = getLaunchChecklistItems(
    { ...access, hasVisitedEditor: true, productCount: null, productCountUnavailable: true },
    translate as Parameters<typeof getLaunchChecklistItems>[1],
  ).find((item) => item.id === "catalog");

  assert.equal(catalog?.ready, false);
  assert.equal(catalog?.description, "overview.launch.catalogUnavailable");
  assert.equal(catalog?.current, false);
  assert.equal(catalog?.href.includes("create="), false);
});
