import assert from "node:assert/strict";
import test from "node:test";

import { buildOptionPairFilters } from "./service";

test("option filters broaden within a group and narrow across groups", () => {
  const small = JSON.stringify(["Size", "Small"]);
  const large = JSON.stringify(["Size", "Large"]);
  const black = JSON.stringify(["Color", "Black"]);
  assert.deepEqual(buildOptionPairFilters([small, large, black]), [
    `(option_pairs = ${JSON.stringify(small)} OR option_pairs = ${JSON.stringify(large)})`,
    `(option_pairs = ${JSON.stringify(black)})`,
  ]);
});
