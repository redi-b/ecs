import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filenameFromContentDisposition } from "./export-filename.js";

describe("filenameFromContentDisposition", () => {
  it("uses quoted and UTF-8 filenames", () => {
    assert.equal(
      filenameFromContentDisposition(
        'attachment; filename="ecs-orders-20260826-143015.csv"',
        "x.csv",
      ),
      "ecs-orders-20260826-143015.csv",
    );
    assert.equal(
      filenameFromContentDisposition("attachment; filename*=UTF-8''orders-%E1%8B%9B.csv", "x.csv"),
      "orders-ዛ.csv",
    );
  });

  it("falls back and strips path/control characters", () => {
    assert.equal(filenameFromContentDisposition(null, "orders.csv"), "orders.csv");
    assert.equal(
      filenameFromContentDisposition('attachment; filename="../orders.csv"', "x.csv"),
      "..-orders.csv",
    );
    assert.equal(
      filenameFromContentDisposition("attachment; filename*=UTF-8''%E0%A4%A", "orders.csv"),
      "orders.csv",
    );
  });
});
