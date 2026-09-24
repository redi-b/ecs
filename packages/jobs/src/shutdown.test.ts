import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createShutdownController, parseShutdownDeadlineMs } from "./shutdown.js";

describe("shutdown deadline configuration", () => {
  it("uses a safe fallback for missing or invalid values", () => {
    assert.equal(parseShutdownDeadlineMs(undefined), 30_000);
    assert.equal(parseShutdownDeadlineMs("nope", 12_000), 12_000);
    assert.equal(parseShutdownDeadlineMs("0", 12_000), 12_000);
    assert.equal(parseShutdownDeadlineMs("45000"), 45_000);
  });
});

describe("shutdown controller", () => {
  it("runs cleanup steps once and in order", async () => {
    const calls: string[] = [];
    const controller = createShutdownController({
      deadlineMs: 100,
      steps: [
        {
          name: "scheduler",
          run: () => {
            calls.push("scheduler");
          },
        },
        {
          name: "worker",
          run: async () => {
            calls.push("worker");
          },
        },
        {
          name: "database",
          run: () => {
            calls.push("database");
          },
        },
      ],
    });

    assert.equal(await controller.request("SIGTERM"), "completed");
    assert.equal(await controller.request("SIGINT"), "completed");
    assert.deepEqual(calls, ["scheduler", "worker", "database"]);
  });

  it("returns at the deadline when a cleanup step does not finish", async () => {
    const controller = createShutdownController({
      deadlineMs: 5,
      steps: [{ name: "stuck", run: () => new Promise(() => undefined) }],
    });
    assert.equal(await controller.request("SIGTERM"), "timed_out");
  });

  it("forces once when another signal arrives during shutdown", async () => {
    let release: (() => void) | undefined;
    let forceCount = 0;
    const controller = createShutdownController({
      deadlineMs: 1_000,
      force: () => {
        forceCount += 1;
      },
      steps: [
        {
          name: "worker",
          run: () =>
            new Promise<void>((resolve) => {
              release = resolve;
            }),
        },
      ],
    });

    const first = controller.request("SIGTERM");
    assert.equal(await controller.request("SIGINT"), "forced");
    assert.equal(await controller.request("SIGINT"), "forced");
    assert.equal(forceCount, 1);
    release?.();
    assert.equal(await first, "completed");
  });
});
