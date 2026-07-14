import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { after, before, describe, it } from "node:test";

import { createPlatformDb, jobRuns } from "@ecs/db";
import {
  createJobsClient,
  startPlatformWorker,
  type JobsClient,
  type JobHandler,
} from "@ecs/jobs";
import { eq } from "drizzle-orm";
import pg from "pg";

import { systemPingHandler } from "./handlers/system-ping.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const dbUrl =
  process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db";

const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 15_000;

function parseRedisEndpoint(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? Number(parsed.port) : 6379,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

function canConnectTcp(host: string, port: number, timeoutMs = 2_000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function isLiveEnvironmentAvailable(): Promise<boolean> {
  const { host, port } = parseRedisEndpoint(redisUrl);
  const redisOk = await canConnectTcp(host, port);
  if (!redisOk) {
    return false;
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 2_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors when never connected
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const liveAvailable = await isLiveEnvironmentAvailable();

describe("system.ping live enqueue → worker → job_runs", { skip: !liveAvailable }, () => {
  type PlatformDbHandle = ReturnType<typeof createPlatformDb>;

  let platformDb: PlatformDbHandle;
  let client: JobsClient;
  let worker: { close: () => Promise<void> };
  const createdIds: string[] = [];
  const queueName = `platform-test-${randomUUID()}`;
  const prefix = "ecs-test";

  before(() => {
    platformDb = createPlatformDb({ connectionString: dbUrl, max: 2 });
    client = createJobsClient({
      redisUrl,
      db: platformDb.db,
      queueName,
      prefix,
    });
    worker = startPlatformWorker({
      redisUrl,
      db: platformDb.db,
      queueName,
      prefix,
      concurrency: 1,
      handlers: {
        "system.ping": systemPingHandler as JobHandler,
      },
    });
  });

  after(async () => {
    try {
      await worker?.close();
    } catch {
      // best-effort cleanup
    }
    try {
      await client?.close();
    } catch {
      // best-effort cleanup
    }
    if (platformDb) {
      for (const id of createdIds) {
        try {
          await platformDb.db.delete(jobRuns).where(eq(jobRuns.id, id));
        } catch {
          // ignore cleanup failures
        }
      }
      await platformDb.pool.end();
    }
  });

  it("completes system.ping with pong: true", async () => {
    const enqueued = await client.enqueueJob({
      name: "system.ping",
      payload: { message: "smoke" },
    });
    createdIds.push(enqueued.jobRunId);

    assert.equal(enqueued.reused, false);
    assert.equal(enqueued.status, "queued");
    assert.equal(enqueued.name, "system.ping");

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let record = await client.getJobRun(enqueued.jobRunId);

    while (
      record &&
      record.status !== "completed" &&
      record.status !== "failed" &&
      Date.now() < deadline
    ) {
      await sleep(POLL_INTERVAL_MS);
      record = await client.getJobRun(enqueued.jobRunId);
    }

    assert.ok(record, "expected job_run row to exist");
    assert.equal(
      record.status,
      "completed",
      `expected completed, got ${record.status}${record.error ? `: ${record.error}` : ""}`,
    );

    const result = record.result as { pong?: unknown; message?: unknown; at?: unknown };
    assert.equal(result?.pong, true);
    assert.equal(result?.message, "smoke");
    assert.equal(typeof result?.at, "string");
  });
});
