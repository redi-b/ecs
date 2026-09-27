import assert from "node:assert/strict";
import test from "node:test";

import { type AfroVariantOption, resolveAfroVariant } from "./lib";

/**
 * The PDP writes the resolved variant's id straight into the hidden `variantId`
 * field, so a match that is too loose does not produce a cosmetic bug — it puts
 * the wrong size or colour, at the wrong price, in the customer's cart. These
 * tests pin the strictness of that match.
 */
const variants: AfroVariantOption[] = [
  {
    id: "v-small-brown",
    inStock: true,
    priceAmount: 1200,
    currencyCode: "ETB",
    optionValues: { Size: "S", Colour: "Brown" },
  },
  {
    id: "v-small-black",
    inStock: true,
    priceAmount: 1250,
    currencyCode: "ETB",
    optionValues: { Size: "S", Colour: "Black" },
  },
  {
    id: "v-large-brown",
    inStock: false,
    priceAmount: 1400,
    currencyCode: "ETB",
    optionValues: { Size: "L", Colour: "Brown" },
  },
];

test("a full selection resolves to the variant matching every axis", () => {
  const found = resolveAfroVariant(variants, { Size: "L", Colour: "Brown" });
  assert.equal(found?.id, "v-large-brown");
  assert.equal(found?.inStock, false, "out-of-stock must survive resolution");
});

test("axes that are not part of the variant cannot match", () => {
  // A shopper picking "XL" where no XL variant exists must not be served S/Brown.
  const found = resolveAfroVariant(variants, { Size: "XL", Colour: "Brown" });
  assert.equal(found, null);
});

test("a partial selection is refused rather than defaulted", () => {
  assert.equal(resolveAfroVariant(variants, { Size: "S" }), null);
});

test("an empty selection is not a match", () => {
  assert.equal(resolveAfroVariant(variants, {}), null);
  assert.equal(resolveAfroVariant(variants, { Size: undefined }), null);
  assert.equal(resolveAfroVariant(variants, { Size: "" }), null);
});

test("option value matching is exact, not a prefix", () => {
  const extra: AfroVariantOption[] = [{ ...variants[0], id: "v-s", optionValues: { Size: "S" } }];
  assert.equal(resolveAfroVariant(extra, { Size: "S" })?.id, "v-s");
  assert.equal(resolveAfroVariant(extra, { Size: "Small" }), null);
});
