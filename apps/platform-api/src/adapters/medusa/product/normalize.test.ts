import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProduct } from "./normalize.js";

test("normalizes stable option identities and valid explicit swatch metadata", () => {
  const [product] = normalizeProduct({
    id: "prod_1",
    options: [
      {
        id: "opt_color",
        title: "Color",
        values: [
          {
            id: "optval_black",
            value: "Black",
            metadata: {
              ecs_option_value_presentation: {
                version: 1,
                swatch: { kind: "color", value: "#AABBCC" },
              },
            },
          },
          {
            id: "optval_custom",
            value: "Custom",
            metadata: {
              ecs_option_value_presentation: {
                version: 1,
                swatch: { kind: "color", value: "not-a-color" },
              },
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(product?.options, [
    {
      id: "opt_color",
      title: "Color",
      values: [
        {
          id: "optval_black",
          label: "Black",
          swatch: { kind: "color", value: "#aabbcc", source: "explicit" },
        },
        { id: "optval_custom", label: "Custom" },
      ],
    },
  ]);
});
