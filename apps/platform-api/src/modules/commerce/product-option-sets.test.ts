import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProductOptionSetValues } from "./product-option-sets.js";

test("normalizes reusable option values without changing their merchant labels", () => {
  assert.deepEqual(
    normalizeProductOptionSetValues([
      { label: " Red ", displayMode: "swatch", swatch: { kind: "color", value: "#DC2626" } },
      { label: "red" },
      { label: "Blue", swatch: { kind: "color", value: "not-a-color" } },
      { label: " " },
    ]),
    [
      { label: "Red", displayMode: "swatch", swatch: { kind: "color", value: "#dc2626" } },
      { label: "Blue" },
    ],
  );
});
