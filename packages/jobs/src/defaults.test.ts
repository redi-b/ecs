import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_QUEUE_NAME } from "./defaults.js";

describe("defaults", () => {
  it("uses platform as the default queue name", () => {
    assert.equal(DEFAULT_QUEUE_NAME, "platform");
  });
});
