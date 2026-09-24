import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { productImportContentDigest } from "./product-import-artifact.js";

describe("product import review artifact", () => {
  it("binds the exact reviewed UTF-8 bytes to a stable SHA-256 digest", () => {
    assert.equal(
      productImportContentDigest("schema,product\n1,ቡና\n"),
      "8aad92f10566032e59e43b78bef0284d91819a7eae7c803a1723a2e107610a3c",
    );
    assert.notEqual(
      productImportContentDigest("schema,product\n1,ቡና\n"),
      productImportContentDigest("schema,product\n1,ቡና"),
    );
  });
});
