import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getPlatformApiServiceDir } from "./env.js";

describe("getPlatformApiServiceDir", () => {
  it("resolves the platform api package directory from a source module url", () => {
    const moduleUrl = new URL("../index.ts", import.meta.url).href;
    const expectedServiceDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

    assert.equal(getPlatformApiServiceDir(moduleUrl), expectedServiceDir);
  });
});
