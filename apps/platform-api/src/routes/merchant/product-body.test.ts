import assert from "node:assert/strict";
import test from "node:test";

import { getOptionalBodyProductOptions } from "./product-body.js";

test("product options accept legacy labels and structured swatches", () => {
  assert.deepEqual(
    getOptionalBodyProductOptions({
      options: [
        {
          id: " opt_color ",
          title: " Color ",
          values: [
            " Black ",
            { id: " optval_cream ", label: " Cream ", swatch: { kind: "color", value: "#FdE" } },
            { label: "Natural", swatch: null },
          ],
        },
      ],
    }),
    [
      {
        id: "opt_color",
        title: "Color",
        values: [
          { label: "Black" },
          { id: "optval_cream", label: "Cream", swatch: { kind: "color", value: "#ffddee" } },
          { label: "Natural", swatch: null },
        ],
      },
    ],
  );
});
