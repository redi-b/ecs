import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getListErrorState } from "./list-error-state.js";

describe("getListErrorState", () => {
  it("maps missing commerce credentials to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_credentials_missing"), {
      description: "Product data is not ready yet. Check the shop setup or contact support.",
      kind: "setup",
      title: "Commerce connection needs attention",
    });
    assert.deepEqual(getListErrorState("customers", "commerce_credentials_missing"), {
      description: "Customer data is not ready yet. Check the shop setup or contact support.",
      kind: "setup",
      title: "Commerce connection needs attention",
    });
  });

  it("maps invalid commerce credentials to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_credentials_invalid"), {
      description: "Products are temporarily unavailable. Check the shop setup or contact support.",
      kind: "setup",
      title: "Commerce connection needs attention",
    });
    assert.deepEqual(getListErrorState("promotions", "commerce_credentials_invalid"), {
      description:
        "Promotions are temporarily unavailable. Check the shop setup or contact support.",
      kind: "setup",
      title: "Commerce connection needs attention",
    });
  });

  it("maps missing sales channel configuration to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_sales_channel_unavailable"), {
      description: "Products will appear after sales setup is complete.",
      kind: "setup",
      title: "Product channel is not ready",
    });
    assert.deepEqual(getListErrorState("customers", "commerce_sales_channel_unavailable"), {
      description: "Customers will appear after sales setup is complete.",
      kind: "setup",
      title: "Sales channel is not ready",
    });
  });

  it("maps missing region configuration to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_region_unavailable"), {
      description: "Products will appear after regional checkout setup is complete.",
      kind: "setup",
      title: "Shop region is not ready",
    });
  });

  it("maps missing commerce resources to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_resource_missing"), {
      description: "Some shop resources are not ready yet. Try again or contact support.",
      kind: "setup",
      title: "Commerce setup needs attention",
    });
  });

  it("maps commerce backend failures to a service state for all list kinds", () => {
    assert.deepEqual(getListErrorState("orders", "commerce_backend_unavailable"), {
      description: "We could not load orders. Try again in a moment.",
      kind: "service",
      title: "Commerce service is temporarily unavailable",
    });
    assert.deepEqual(getListErrorState("customers", "commerce_backend_unavailable"), {
      description: "We could not load customers. Try again in a moment.",
      kind: "service",
      title: "Commerce service is temporarily unavailable",
    });
    assert.deepEqual(getListErrorState("promotions", "commerce_backend_unavailable"), {
      description: "We could not load promotions. Try again in a moment.",
      kind: "service",
      title: "Commerce service is temporarily unavailable",
    });
  });

  it("maps platform request failures to a service state", () => {
    assert.deepEqual(getListErrorState("products", "platform_request_failed"), {
      description: "We could not load products. Try again in a moment.",
      kind: "service",
      title: "Dashboard service is temporarily unavailable",
    });
  });

  it("keeps unknown errors as technical failures", () => {
    assert.deepEqual(getListErrorState("products", "invalid_products_response"), {
      description: "Product data was incomplete. Try again.",
      kind: "error",
      title: "Products could not be loaded",
    });
  });
});
