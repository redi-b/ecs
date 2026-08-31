import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname } from "node:path";
import test from "node:test";

const assetsDirectory = new URL("../templates/nexahub/v1/assets/", import.meta.url);
const source = (relativePath: string) =>
  new URL(`../templates/nexahub/v1/${relativePath}`, import.meta.url);

test("NexaHub rendered editorial rasters stay within practical delivery budgets", () => {
  const renderedSources = [
    "assets/tech-workspace-hero.webp",
    "assets/contact-store-interior.webp",
    "assets/laptop-connectivity-category.webp",
    "assets/peripheral-devices-category.webp",
    "assets/smartphone-devices-category.webp",
    "assets/product-quality-phone-promo.webp",
    "assets/featured-item-promo.webp",
    "assets/product-listing-hero-texture.webp",
  ];

  for (const path of renderedSources) {
    const bytes = statSync(source(path)).size;
    assert.ok(bytes <= 700 * 1024, `${path} is ${(bytes / 1024).toFixed(1)} KB`);
  }
});

test("NexaHub renderers do not ship copied multi-megabyte PNG sources", () => {
  const rendererSource = ["Home.astro", "ProductList.astro", "Product.astro"]
    .map((file) => readFileSync(source(file), "utf8"))
    .join("\n");
  for (const file of readdirSync(assetsDirectory)) {
    if (extname(file).toLowerCase() !== ".png") continue;
    if (statSync(new URL(file, assetsDirectory)).size > 700 * 1024) {
      assert.equal(rendererSource.includes(file), false, `${file} must not be referenced by a renderer`);
    }
  }
});
