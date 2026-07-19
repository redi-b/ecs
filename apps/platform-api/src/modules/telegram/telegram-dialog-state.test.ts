import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { clearDialog, getDialog, setDialog } from "./telegram-dialog-state.js";

describe("telegram-dialog-state", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["Date"] });
    clearDialog("u1", "c1");
  });
  afterEach(() => {
    mock.timers.reset();
  });

  it("returns null after TTL", () => {
    setDialog("u1", "c1", {
      flow: "sale",
      step: "pick_product",
      tenantId: "t",
      userId: "u",
      salesChannelId: "sc",
      stockLocationId: null,
      regionId: null,
      shippingOptionId: null,
    });
    assert.equal(getDialog("u1", "c1")?.step, "pick_product");
    mock.timers.tick(21 * 60 * 1000);
    assert.equal(getDialog("u1", "c1"), null);
  });
});
