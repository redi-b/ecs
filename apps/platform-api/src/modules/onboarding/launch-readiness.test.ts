import assert from "node:assert/strict";
import test from "node:test";
import type { MerchantProduct } from "../../types/index.js";
import { buildLaunchReadiness, isPurchasableLaunchProduct } from "./launch-readiness.js";

const details = {
  version: 1,
  categories: ["Fashion"],
  description: "",
  primaryPhone: "+251912345678",
  additionalPhones: [],
  publicEmail: "",
  socialProfiles: [],
  address: { city: "Addis Ababa", streetAddress: "Bole", directions: "" },
};
const snapshot = {
  tenantId: "shop",
  name: "Shop",
  handle: "shop",
  shopDetails: details,
  isPublished: false,
  data: { title: "Shop" },
  themeTokens: { primary: "#3064d5" },
  templateId: "template",
  completedSteps: [],
  catalogStatus: "ready" as const,
  commerceReady: true,
  delivery: { deliveryEnabled: true, pickupEnabled: true },
};

test("review is a durable launch milestone across later storefront changes", () => {
  const pending = buildLaunchReadiness(snapshot);
  assert.equal(pending.canPublish, false);
  const confirmed = {
    ...snapshot,
    completedSteps: ["storefront_reviewed"],
  };
  assert.equal(buildLaunchReadiness(confirmed).canPublish, true);
  for (const change of [
    { data: { title: "Changed" } },
    { themeTokens: { primary: "#000000" } },
    { name: "Renamed" },
    { shopDetails: { ...details, primaryPhone: "+251911111111" } },
  ]) {
    assert.equal(buildLaunchReadiness({ ...confirmed, ...change }).canPublish, true);
  }
});

test("keeps legacy fingerprinted review records complete", () => {
  const pending = buildLaunchReadiness(snapshot);
  assert.equal(
    buildLaunchReadiness({
      ...snapshot,
      completedSteps: [`storefront_review:${pending.draftFingerprint}`],
    }).canPublish,
    true,
  );
});

test("outages stay unknown and either supported fulfillment method is launch-ready", () => {
  assert.equal(
    buildLaunchReadiness({ ...snapshot, catalogStatus: "unavailable" }).checks.find(
      (check) => check.id === "catalog",
    )?.status,
    "unavailable",
  );
  assert.equal(
    buildLaunchReadiness({
      ...snapshot,
      shopDetails: { ...details, address: undefined },
    }).checks.find((check) => check.id === "fulfillment")?.status,
    "ready",
  );
  assert.equal(
    buildLaunchReadiness({
      ...snapshot,
      delivery: { deliveryEnabled: false, pickupEnabled: true },
      shopDetails: { ...details, address: undefined },
    }).checks.find((check) => check.id === "fulfillment")?.status,
    "ready",
  );
  assert.equal(
    buildLaunchReadiness({
      ...snapshot,
      delivery: { deliveryEnabled: false, pickupEnabled: false },
    }).checks.find((check) => check.id === "fulfillment")?.status,
    "action_required",
  );
});

test("does not ask merchants to configure the default cash-on-delivery path", () => {
  assert.equal(
    buildLaunchReadiness(snapshot).checks.some((check) => check.id === "payments"),
    false,
  );
});

test("catalog readiness needs published, ETB-priced, orderable stock", () => {
  const product = {
    status: "published",
    handle: "product",
    variants: [{ prices: [{ currencyCode: "etb", amount: 100 }], stock: { availableQuantity: 1 } }],
  } as unknown as MerchantProduct;
  assert.equal(isPurchasableLaunchProduct(product), true);
  assert.equal(isPurchasableLaunchProduct({ ...product, status: "draft" }), false);
  assert.equal(
    isPurchasableLaunchProduct({
      ...product,
      variants: [{ ...product.variants![0]!, prices: [{ currencyCode: "usd", amount: 100 }] }],
    }),
    false,
  );
  assert.equal(
    isPurchasableLaunchProduct({
      ...product,
      variants: [{ ...product.variants![0]!, stock: null }],
    }),
    false,
  );
  assert.equal(
    isPurchasableLaunchProduct({
      ...product,
      variants: [{ ...product.variants![0]!, stock: null, manageInventory: false }],
    }),
    true,
  );
});
