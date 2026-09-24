import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import {
  createJobRegistry,
  defineJob,
  InvalidJobPayloadError,
  InvalidJobResultError,
  UnknownJobDefinitionError,
} from "./registry.js";

const example = defineJob({
  attempts: 4,
  backoff: { delayMs: 1_000, jitter: 0.2, type: "exponential" },
  idempotency: "required",
  manualRetry: "safe",
  name: "catalog.import",
  payloadSchema: z.object({ executionId: z.string().min(1) }),
  queue: "bulk",
  resultSchema: z.object({ imported: z.number().int().nonnegative() }),
  retention: { completedSeconds: 86_400, failedSeconds: 604_800 },
  retry: "classified",
  timeoutMs: 60_000,
  version: 1,
});

describe("job definition registry", () => {
  it("validates payloads and results through one definition", () => {
    const registry = createJobRegistry([example]);
    assert.deepEqual(registry.parsePayload("catalog.import", { executionId: "run_1" }), {
      executionId: "run_1",
    });
    assert.deepEqual(registry.parseResult("catalog.import", { imported: 2 }), { imported: 2 });
    assert.throws(
      () => registry.parsePayload("catalog.import", { executionId: "" }),
      InvalidJobPayloadError,
    );
    assert.throws(
      () => registry.parseResult("catalog.import", { imported: -1 }),
      InvalidJobResultError,
    );
  });

  it("fails closed for unknown and duplicate jobs", () => {
    const registry = createJobRegistry([example]);
    assert.throws(() => registry.require("missing.job"), UnknownJobDefinitionError);
    assert.throws(() => createJobRegistry([example, example]), /Duplicate job definition/);
  });

  it("rejects unsafe definition policy at startup", () => {
    assert.throws(
      () =>
        defineJob({
          ...example,
          attempts: 0,
          name: "broken job",
        }),
      /Invalid job definition name/,
    );
  });
});
