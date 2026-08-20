import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const templateRoot = new URL("../templates/luvia/v1/", import.meta.url);
const assetRoot = new URL("assets/", templateRoot);

test("Luvia template raster assets stay web-ready and within budget", async () => {
  const files = await readdir(assetRoot);
  const rasters = files.filter((file) => /\.(?:avif|jpe?g|png|webp)$/i.test(file));
  const sizes = await Promise.all(rasters.map(async (file) => (await stat(new URL(file, assetRoot))).size));

  assert.ok(rasters.length > 0);
  assert.deepEqual(rasters.filter((file) => !file.endsWith(".webp")), []);
  assert.ok(Math.max(...sizes) < 1_000_000, "individual template assets must stay below 1 MB");
  assert.ok(sizes.reduce((total, size) => total + size, 0) < 3_000_000, "template raster assets must stay below 3 MB total");
});

test("Luvia static editorial images use the responsive Astro image boundary", async () => {
  const files = ["Home.astro", "About.astro", "Contact.astro", "ProductList.astro"];
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, templateRoot), "utf8")));
  const styles = await Promise.all(
    ["home.scss", "about.scss", "contact.scss", "product-list.scss"].map((file) =>
      readFile(new URL(`styles/${file}`, templateRoot), "utf8"),
    ),
  );

  assert.ok(sources.every((source) => source.includes("TemplateImage")));
  const adapter = await readFile(new URL("TemplateImage.astro", templateRoot), "utf8");
  assert.match(adapter, /components\/media\/TemplateAsset\.astro/);
  assert.ok(styles.every((source) => !/url\([^)]*\.(?:png|jpe?g|webp)/i.test(source)));
});
