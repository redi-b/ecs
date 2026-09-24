import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getImageOptionTag,
  resolveProductMediaVariant,
} from "./product-media-variants";

describe("product-media-variants helpers", () => {
  const masterUrl = "https://media.example.com/s/tenant_1/ast_1/photo.jpg";
  const metadata = {
    media_variants: {
      [masterUrl]: {
        w200: "https://media.example.com/s/tenant_1/ast_1/photo-200w.webp",
        w400: "https://media.example.com/s/tenant_1/ast_1/photo-400w.webp",
        w800: "https://media.example.com/s/tenant_1/ast_1/photo-800w.webp",
        w1200: "https://media.example.com/s/tenant_1/ast_1/photo-1200w.webp",
      },
    },
    option_media_bindings: {
      optionTitle: "Color",
      mappings: {
        "Midnight Blue": [masterUrl],
        "Crimson Red": ["https://media.example.com/other.jpg"],
      },
    },
  };

  it("resolves preferred derivative tier if present", () => {
    assert.equal(
      resolveProductMediaVariant(masterUrl, metadata, "w200"),
      "https://media.example.com/s/tenant_1/ast_1/photo-200w.webp",
    );
    assert.equal(
      resolveProductMediaVariant(masterUrl, metadata, "w400"),
      "https://media.example.com/s/tenant_1/ast_1/photo-400w.webp",
    );
    assert.equal(
      resolveProductMediaVariant(masterUrl, metadata, "w1200"),
      "https://media.example.com/s/tenant_1/ast_1/photo-1200w.webp",
    );
  });

  it("falls back to master URL if metadata or variant is missing", () => {
    assert.equal(resolveProductMediaVariant(masterUrl, null, "w400"), masterUrl);
    assert.equal(resolveProductMediaVariant(masterUrl, {}, "w400"), masterUrl);
    assert.equal(
      resolveProductMediaVariant("https://media.example.com/unknown.jpg", metadata, "w400"),
      "https://media.example.com/unknown.jpg",
    );
    assert.equal(resolveProductMediaVariant(null, metadata, "w400"), "");
  });

  it("extracts option title and value for a tagged image", () => {
    const tag = getImageOptionTag(masterUrl, metadata.option_media_bindings);
    assert.deepEqual(tag, {
      optionTitle: "Color",
      optionValue: "Midnight Blue",
    });
  });

  it("returns null when image is untagged or bindings missing", () => {
    assert.equal(
      getImageOptionTag("https://media.example.com/unmapped.jpg", metadata.option_media_bindings),
      null,
    );
    assert.equal(getImageOptionTag(masterUrl, null), null);
    assert.equal(getImageOptionTag(masterUrl, {}), null);
  });
});
