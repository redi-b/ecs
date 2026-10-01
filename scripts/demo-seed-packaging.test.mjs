import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

test("the deployed API seed resolves every curated product and taxonomy image without a workspace checkout", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "ecs-seed-packaging-"));
  try {
    const app = join(temporary, "app");
    // pnpm deploy includes API source, but not sibling storefront files.
    await cp(join(root, "apps/platform-api/src/seeds"), join(app, "src/seeds"), {
      recursive: true,
    });
    const dockerfile = await readFile(join(root, "infra/docker/Dockerfile"), "utf8");
    const runtime = dockerfile.split("FROM runtime AS platform-api\n")[1]?.split("\nFROM ")[0];
    assert.ok(runtime, "Platform API runtime target must exist");
    // Materialize the actual asset COPY instructions into the runtime layout.
    for (const match of runtime.matchAll(
      /^COPY --chown=node:node --from=platform-api-build (\/workspace\/apps\/storefront\/\S+) (\.\/\S+)$/gm,
    )) {
      const source = resolve(root, match[1].slice("/workspace/".length));
      const destination = resolve(app, match[2]);
      assert.ok(destination.startsWith(`${app}/`));
      await cp(source, destination, { recursive: true });
    }
    const loader = join(root, "node_modules/tsx/dist/loader.mjs");
    const childEnv = {
      ...process.env,
      TSX_TSCONFIG_PATH: join(root, "apps/platform-api/tsconfig.json"),
    };
    // This is a seed subprocess, not a nested Node test-runner worker.
    delete childEnv.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        loader,
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { demoShops, demoProductImages } from ${JSON.stringify(pathToFileURL(join(app, "src/seeds/demo-shops.ts")).href)};
      import { demoTaxonomyImage } from ${JSON.stringify(pathToFileURL(join(app, "src/seeds/demo/product-images.ts")).href)};
      let checked = 0;
      for (const shop of demoShops) {
        for (const product of shop.products) {
          const images = demoProductImages(product.handle);
          assert.ok(images.length, 'Demo product ' + product.handle + ' needs at least one curated image');
          for (const image of images) { assert.ok((await readFile(new URL(image.url))).length); checked++; }
        }
        for (const item of [...shop.categories, ...shop.collections]) {
          if (!item.mediaUrl) continue;
          const image = demoTaxonomyImage(item.mediaUrl, shop.templateKey);
          assert.ok(image, 'Missing curated taxonomy image: ' + item.mediaUrl);
          assert.ok((await readFile(new URL(image.url))).length); checked++;
        }
      }
      console.log('Verified ' + checked + ' curated image references');
    `,
      ],
      {
        cwd: app,
        encoding: "utf8",
        timeout: 20_000,
        env: childEnv,
      },
    );
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /Verified \d+ curated image references/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
