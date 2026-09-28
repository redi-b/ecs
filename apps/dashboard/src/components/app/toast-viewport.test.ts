import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { visibleToastState } from "./toast-viewport.js";

describe("visibleToastState", () => {
  it("shows the newest entries up to the responsive limit", () => {
    assert.deepEqual(visibleToastState(["newest", "middle", "oldest"], 2), {
      overflow: 1,
      visible: ["newest", "middle"],
    });
  });

  it("promotes the next queued entry after the first is removed", () => {
    const initial = visibleToastState(["newest", "middle", "oldest"], 2);
    const promoted = visibleToastState(initial.visible.slice(1).concat("oldest"), 2);
    assert.deepEqual(promoted, {
      overflow: 0,
      visible: ["middle", "oldest"],
    });
  });

  it("always exposes at least one toast for an invalid limit", () => {
    assert.deepEqual(visibleToastState(["one", "two"], 0), {
      overflow: 1,
      visible: ["one"],
    });
  });
});
