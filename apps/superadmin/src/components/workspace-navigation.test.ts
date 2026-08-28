import assert from "node:assert/strict";
import test from "node:test";

import { getWorkspaceIndicatorStyle } from "./workspace-navigation";

test("workspace indicator stays within every section", () => {
  assert.deepEqual(getWorkspaceIndicatorStyle(3, 0), {
    transform: "translate3d(0%, 0, 0)",
    width: "calc((100% - 0.75rem) / 3)",
  });
  assert.deepEqual(getWorkspaceIndicatorStyle(3, 2), {
    transform: "translate3d(200%, 0, 0)",
    width: "calc((100% - 0.75rem) / 3)",
  });
});

test("workspace indicator clamps stale section indexes", () => {
  assert.deepEqual(getWorkspaceIndicatorStyle(3, 9), {
    transform: "translate3d(200%, 0, 0)",
    width: "calc((100% - 0.75rem) / 3)",
  });
});
