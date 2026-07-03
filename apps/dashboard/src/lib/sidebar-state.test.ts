import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSidebarDefaultOpen } from "./sidebar-state.js";

describe("getSidebarDefaultOpen", () => {
  it("starts collapsed when the shadcn sidebar cookie is false", () => {
    assert.equal(getSidebarDefaultOpen("false"), false);
  });

  it("starts expanded for missing or non-false cookie values", () => {
    assert.equal(getSidebarDefaultOpen(undefined), true);
    assert.equal(getSidebarDefaultOpen("true"), true);
    assert.equal(getSidebarDefaultOpen("unexpected"), true);
  });
});
