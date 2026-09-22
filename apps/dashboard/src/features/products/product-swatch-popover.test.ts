import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductOptionSwatch } from "@ecs/contracts";
import {
  ProductColorPopover,
  buildProductOptionSwatch,
  getSwatchMode,
  normalizeProductOptionSwatch,
  serializeProductOptionSwatch,
} from "./product-form-sections";

describe("ProductOptionSwatch serialization and mode switching", () => {
  it("normalizes color swatches and lowercases hex codes", () => {
    const swatch = normalizeProductOptionSwatch({ kind: "color", value: "#FF5733" });
    assert.deepEqual(swatch, { kind: "color", value: "#ff5733" });
  });

  it("normalizes image swatches with URLs", () => {
    const swatch = normalizeProductOptionSwatch({
      kind: "image",
      url: "https://example.com/textures/denim.jpg",
    });
    assert.deepEqual(swatch, {
      kind: "image",
      url: "https://example.com/textures/denim.jpg",
    });
  });

  it("handles legacy string color values for backwards compatibility", () => {
    const swatch = normalizeProductOptionSwatch("#10B981");
    assert.deepEqual(swatch, { kind: "color", value: "#10b981" });
  });

  it("handles legacy string URL values for backwards compatibility", () => {
    const swatch = normalizeProductOptionSwatch("https://example.com/fabric.png");
    assert.deepEqual(swatch, { kind: "image", url: "https://example.com/fabric.png" });
  });

  it("returns undefined for null or undefined swatch input", () => {
    assert.equal(normalizeProductOptionSwatch(undefined), undefined);
    assert.equal(normalizeProductOptionSwatch(null), undefined);
  });

  it("serializes color and image swatches for snapshot storage", () => {
    assert.equal(
      serializeProductOptionSwatch({ kind: "color", value: "#AABBCC" }),
      "#aabbcc",
    );
    assert.equal(
      serializeProductOptionSwatch({
        kind: "image",
        url: "https://example.com/texture.png",
      }),
      "https://example.com/texture.png",
    );
    assert.equal(serializeProductOptionSwatch(undefined), null);
    assert.equal(serializeProductOptionSwatch(null), null);
  });

  it("detects mode based on swatch type", () => {
    assert.equal(getSwatchMode({ kind: "color", value: "#000000" }), "color");
    assert.equal(
      getSwatchMode({ kind: "image", url: "https://example.com/silk.png" }),
      "image",
    );
    assert.equal(getSwatchMode("#123456"), "color");
    assert.equal(getSwatchMode("https://example.com/silk.png"), "image");
    assert.equal(getSwatchMode(undefined), "color");
  });

  it("builds swatch payload based on active mode", () => {
    const colorSwatch = buildProductOptionSwatch("color", "#EF4444", "");
    assert.deepEqual(colorSwatch, { kind: "color", value: "#ef4444" });

    const imageSwatch = buildProductOptionSwatch(
      "image",
      "#ef4444",
      "https://example.com/pattern.webp",
    );
    assert.deepEqual(imageSwatch, {
      kind: "image",
      url: "https://example.com/pattern.webp",
    });
  });

  it("renders color swatch trigger button with colored circle", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductColorPopover, {
        label: "Crimson",
        onSave: () => {},
        value: { kind: "color", value: "#dc2626" },
      }),
    );
    assert.match(markup, /Crimson/);
    assert.match(markup, /background-color:#dc2626/);
    assert.doesNotMatch(markup, /<img/);
  });

  it("renders image swatch trigger button with thumbnail image", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductColorPopover, {
        label: "Blue Tweed",
        onSave: () => {},
        value: { kind: "image", url: "https://example.com/tweed.jpg" },
      }),
    );
    assert.match(markup, /Blue Tweed/);
    assert.match(markup, /<img/);
    assert.match(markup, /src="https:\/\/example\.com\/tweed\.jpg"/);
    assert.match(markup, /size-3\.5 rounded-full object-cover border shadow-xs/);
  });
});
