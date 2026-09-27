import assert from "node:assert/strict";
import test from "node:test";

import { getStorefrontSeoEditorValues, resolveStorefrontSeoPreview } from "./storefront-seo-editor";

test("keeps automatic SEO values empty while previewing current shop details", () => {
  const values = getStorefrontSeoEditorValues({
    title: null,
    description: null,
    socialImageUrl: null,
  });

  assert.deepEqual(values, { title: "", description: "", socialImageUrl: "" });
  assert.deepEqual(
    resolveStorefrontSeoPreview({
      fallbackDescription: "Fresh coffee from Addis",
      fallbackTitle: "Buna House",
      values,
    }),
    { title: "Buna House", description: "Fresh coffee from Addis" },
  );
});

test("preserves explicit search and sharing overrides", () => {
  const values = getStorefrontSeoEditorValues({
    title: "Buy Ethiopian coffee online",
    description: "Roasted weekly and delivered nationwide.",
    socialImageUrl: null,
  });

  assert.deepEqual(
    resolveStorefrontSeoPreview({
      fallbackDescription: "Shop description",
      fallbackTitle: "Shop name",
      values,
    }),
    {
      title: "Buy Ethiopian coffee online",
      description: "Roasted weekly and delivered nationwide.",
    },
  );
});
