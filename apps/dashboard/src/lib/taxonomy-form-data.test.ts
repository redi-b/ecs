import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTaxonomyFormInput } from "./taxonomy-form-data";

describe("getTaxonomyFormInput", () => {
  it("normalizes taxonomy names, handles, and media references", () => {
    const formData = new FormData();
    formData.set("handle", "  featured-tech  ");
    formData.set("mediaUrl", "  https://cdn.example.com/taxonomy/featured.jpg  ");
    formData.set("name", "  Featured tech  ");

    assert.deepEqual(getTaxonomyFormInput(formData), {
      handle: "featured-tech",
      mediaUrl: "https://cdn.example.com/taxonomy/featured.jpg",
      name: "Featured tech",
      title: null,
    });
  });

  it("returns null for empty optional taxonomy values", () => {
    assert.deepEqual(getTaxonomyFormInput(new FormData()), {
      handle: null,
      mediaUrl: null,
      name: null,
      title: null,
    });
  });
});
