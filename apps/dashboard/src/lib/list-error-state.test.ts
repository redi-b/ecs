import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getListErrorState } from "./list-error-state.js";

describe("getListErrorState", () => {
  it("maps missing commerce credentials to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_credentials_missing"), {
      description:
        "Start Platform API with MEDUSA_ADMIN_API_TOKEN from the Medusa seed before loading live product data.",
      kind: "setup",
      title: "Medusa admin token is not configured",
    });
  });

  it("maps invalid commerce credentials to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_credentials_invalid"), {
      description:
        "Medusa rejected the configured MEDUSA_ADMIN_API_TOKEN. Re-run the Medusa seed for the active Medusa database, copy the new secret token into Platform API, restart Platform API, then reload products.",
      kind: "setup",
      title: "Medusa admin token is invalid",
    });
  });

  it("maps missing sales channel configuration to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_sales_channel_unavailable"), {
      description:
        "This tenant is missing its Medusa sales channel mapping. Re-run provisioning or seed data, then reload products.",
      kind: "setup",
      title: "Product sales channel is not configured",
    });
  });

  it("maps missing region configuration to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_region_unavailable"), {
      description:
        "This tenant is missing its Medusa region mapping. Re-run provisioning or seed data, then reload products.",
      kind: "setup",
      title: "Commerce region is not configured",
    });
  });

  it("maps missing commerce resources to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_resource_missing"), {
      description:
        "The tenant has Medusa resource IDs, but Medusa did not return the expected resources. Re-run local commerce provisioning or seed data.",
      kind: "setup",
      title: "Commerce resources are out of sync",
    });
  });

  it("maps commerce backend failures to a service state", () => {
    assert.deepEqual(getListErrorState("orders", "commerce_backend_unavailable"), {
      description:
        "The commerce backend could not be reached. Start Medusa or check the commerce service connection, then reload orders.",
      kind: "service",
      title: "Commerce backend is unavailable",
    });
  });

  it("maps platform request failures to a service state", () => {
    assert.deepEqual(getListErrorState("products", "platform_request_failed"), {
      description:
        "The dashboard could not reach Platform API. Start the API service, then reload products.",
      kind: "service",
      title: "Platform API is unavailable",
    });
  });

  it("keeps unknown errors as technical failures", () => {
    assert.deepEqual(getListErrorState("products", "invalid_products_response"), {
      description: "invalid_products_response",
      kind: "error",
      title: "Products could not be loaded",
    });
  });
});
