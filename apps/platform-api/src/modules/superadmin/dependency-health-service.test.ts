import assert from "node:assert/strict";
import test from "node:test";

import { createDependencyHealthService } from "./dependency-health-service.js";

test("dependency health distinguishes live failure from missing configuration", async () => {
  const service = createDependencyHealthService({
    checks: {
      commerce_backend: async () => undefined,
      storefront_runtime: async () => {
        throw new Error("offline");
      },
      job_queue: null,
      media_storage: async () => undefined,
    },
    now: () => new Date("2026-08-27T10:00:00.000Z"),
  });

  const dependencies = await service();
  assert.deepEqual(
    dependencies.map(({ id, status, evidence }) => ({ id, status, evidence })),
    [
      { id: "platform_database", status: "operational", evidence: "request" },
      { id: "commerce_backend", status: "operational", evidence: "live_check" },
      { id: "storefront_runtime", status: "unavailable", evidence: "live_check" },
      { id: "job_queue", status: "not_configured", evidence: "live_check" },
      { id: "media_storage", status: "operational", evidence: "live_check" },
    ],
  );
});

test("dependency health bounds a stalled check", async () => {
  const service = createDependencyHealthService({
    checks: { commerce_backend: () => new Promise(() => undefined) },
    timeoutMs: 5,
  });

  const dependencies = await service();
  assert.equal(
    dependencies.find((dependency) => dependency.id === "commerce_backend")?.status,
    "unavailable",
  );
});
