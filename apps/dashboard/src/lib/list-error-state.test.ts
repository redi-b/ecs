import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getListErrorState } from "./list-error-state.js";

describe("getListErrorState", () => {
  it("maps missing commerce credentials to a setup state", () => {
    assert.deepEqual(getListErrorState("products", "commerce_credentials_missing"), {
      description:
        "Product sync needs the Medusa Admin API token before live catalog data can be loaded.",
      kind: "setup",
      title: "Commerce credentials are not configured",
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

  it("keeps unknown errors as technical failures", () => {
    assert.deepEqual(getListErrorState("products", "invalid_products_response"), {
      description: "invalid_products_response",
      kind: "error",
      title: "Products could not be loaded",
    });
  });
});
