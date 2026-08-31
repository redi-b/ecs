import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOptionValuePresentationMutations,
  readOptionValuePresentationPayload,
} from "./product-option-value-presentations.js";

const product = {
  id: "prod_1",
  options: [
    {
      id: "opt_color",
      title: "Color",
      values: [
        {
          id: "optval_black",
          value: "Black",
          metadata: { retained: true },
        },
      ],
    },
  ],
} as any;

test("reads only the namespaced, versioned additional-data payload", () => {
  assert.equal(readOptionValuePresentationPayload({ unrelated: true }), null);
  assert.deepEqual(
    readOptionValuePresentationPayload({
      ecs_product_option_value_presentations: {
        version: 1,
        values: [
          {
            optionTitle: "Color",
            valueLabel: "Black",
            swatch: { kind: "color", value: "#111111" },
          },
        ],
      },
    })?.values[0]?.swatch,
    { kind: "color", value: "#111111" },
  );
});

test("matches by normalized title and label while preserving unrelated metadata", () => {
  const [mutation] = buildOptionValuePresentationMutations([product], [
    {
      optionTitle: " color ",
      valueLabel: " black ",
      swatch: { kind: "color", value: "#ABCDEF" },
    },
  ]);

  assert.deepEqual(mutation, {
    id: "optval_black",
    metadata: {
      retained: true,
      ecs_option_value_presentation: {
        version: 1,
        swatch: { kind: "color", value: "#abcdef" },
      },
    },
    previousMetadata: { retained: true },
  });
});

test("stable IDs take precedence and a null swatch removes only the owned key", () => {
  const withPresentation = {
    ...product,
    options: [
      {
        ...product.options[0],
        values: [
          {
            ...product.options[0].values[0],
            metadata: {
              retained: true,
              ecs_option_value_presentation: { version: 1, swatch: { kind: "color", value: "#000000" } },
            },
          },
        ],
      },
    ],
  };
  const [mutation] = buildOptionValuePresentationMutations([withPresentation], [
    {
      optionId: "opt_color",
      optionTitle: "Renamed color",
      valueId: "optval_black",
      valueLabel: "Renamed black",
      swatch: null,
    },
  ]);

  assert.deepEqual(mutation?.metadata, { retained: true });
});

test("rejects ambiguous or unmatched values rather than updating the wrong record", () => {
  assert.throws(
    () =>
      buildOptionValuePresentationMutations([product], [
        { optionTitle: "Color", valueLabel: "Missing", swatch: null },
      ]),
    /Could not uniquely match product option value/,
  );
});
