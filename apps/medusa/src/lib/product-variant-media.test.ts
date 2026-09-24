import assert from "node:assert/strict";
import test from "node:test";
import { getVariantImageUpdates, productUpdateChangesMedia } from "./product-variant-media";

const old = "https://media.example/old.jpg";
const next = "https://media.example/next.jpg";
const manual = "https://media.example/manual.jpg";

function product() {
  return {
    thumbnail: next,
    images: [{ url: next }, { url: manual }],
    metadata: { option_media_bindings: { optionTitle: "Color", mappings: { Red: [old, next] } } },
    variants: [
      {
        id: "automatic",
        metadata: { image_url: old, image_source: "option", custom: "keep" },
        options: [{ value: "Red", option: { title: "Color" } }],
      },
      {
        id: "manual",
        metadata: { image_url: manual, image_source: "manual" },
        options: [{ value: "Red", option: { title: "Color" } }],
      },
      {
        id: "legacy",
        metadata: { image_url: old },
        options: [{ value: "Red", option: { title: "Color" } }],
      },
    ].map((variant) => ({ ...variant, metadata: variant.metadata as Record<string, unknown> })),
  };
}

test("automatic photo updates contain only identity and metadata, preserving manual and legacy choices", () => {
  const patches = getVariantImageUpdates(product());
  assert.deepEqual(patches, [
    { id: "automatic", metadata: { image_url: next, image_source: "option", custom: "keep" } },
  ]);
  assert.deepEqual(Object.keys(patches[0]!).sort(), ["id", "metadata"]);
});

test("removed gallery photos clear automatic assignments without changing standalone manual photos", () => {
  const state = product();
  state.thumbnail = "";
  state.images = [];
  assert.deepEqual(getVariantImageUpdates(state), [
    { id: "automatic", metadata: { image_url: null, image_source: null, custom: "keep" } },
  ]);
});

test("removing a tag clears an automatic photo while retaining manual photos", () => {
  const state = product();
  state.metadata.option_media_bindings.mappings.Red = [];
  assert.deepEqual(getVariantImageUpdates(state), [
    { id: "automatic", metadata: { image_url: null, image_source: null, custom: "keep" } },
  ]);
});

test("newly tagged variants receive a photo and repeated reconciliation is idempotent", () => {
  const state = product();
  state.variants[0]!.metadata.image_url = "";
  const patches = getVariantImageUpdates(state);
  state.variants[0]!.metadata = { ...state.variants[0]!.metadata, ...patches[0]!.metadata };
  assert.equal(getVariantImageUpdates(state).length, 0);
});

test("ordinary edits and derivative metadata sync do not run photo reconciliation", () => {
  assert.equal(productUpdateChangesMedia({ title: "New title" }), false);
  assert.equal(productUpdateChangesMedia({ metadata: { media_variants: {} } }), false);
  assert.equal(productUpdateChangesMedia({ images: [] }), true);
  assert.equal(productUpdateChangesMedia({ thumbnail: null }), true);
  assert.equal(productUpdateChangesMedia({ metadata: { option_media_bindings: null } }), true);
});
