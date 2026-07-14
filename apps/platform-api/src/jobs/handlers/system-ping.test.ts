import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { systemPingHandler } from "./system-ping.js";

type SystemPingResult = {
  pong: true;
  at: string;
  message?: string;
};

describe("systemPingHandler", () => {
  it("returns pong true with an ISO timestamp", async () => {
    const before = Date.now();
    const result = (await systemPingHandler({
      jobRunId: "run_1",
      name: "system.ping",
      tenantId: null,
      payload: {},
      attempt: 1,
    })) as SystemPingResult;
    const after = Date.now();

    assert.equal(result.pong, true);
    assert.equal(typeof result.at, "string");
    const atMs = Date.parse(result.at);
    assert.ok(!Number.isNaN(atMs));
    assert.ok(atMs >= before - 1000);
    assert.ok(atMs <= after + 1000);
    assert.equal("message" in result, false);
  });

  it("echoes optional message when provided", async () => {
    const result = (await systemPingHandler({
      jobRunId: "run_2",
      name: "system.ping",
      tenantId: "tenant_1",
      payload: { message: "hello" },
      attempt: 1,
    })) as SystemPingResult;

    assert.equal(result.pong, true);
    assert.equal(result.message, "hello");
  });

  it("omits empty message", async () => {
    const result = (await systemPingHandler({
      jobRunId: "run_3",
      name: "system.ping",
      tenantId: null,
      payload: { message: "" },
      attempt: 1,
    })) as SystemPingResult;

    assert.equal(result.pong, true);
    assert.equal("message" in result, false);
  });
});
