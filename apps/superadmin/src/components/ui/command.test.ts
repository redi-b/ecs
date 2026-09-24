import assert from "node:assert/strict";
import { test } from "node:test";

import { commandItemStateClassName } from "./command.js";

test("command selection styles require cmdk's selected value to be true", () => {
  assert.match(commandItemStateClassName, /data-\[selected=true\]/);
  assert.doesNotMatch(commandItemStateClassName, /(?:^|\s)data-selected:/);
});
