import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

import { ensureS3Bucket } from "./seed-media-storage.js";

describe("ensureS3Bucket", () => {
  it("keeps an existing bucket without trying to recreate it", async () => {
    const commands: string[] = [];
    const result = await ensureS3Bucket(
      {
        async send(command) {
          commands.push(command.constructor.name);
          return {};
        },
      },
      "ecs-media",
    );

    assert.deepEqual(result, { created: false, ok: true });
    assert.deepEqual(commands, [HeadBucketCommand.name]);
  });

  it("creates and verifies a missing bucket", async () => {
    const commands: string[] = [];
    let headAttempts = 0;
    const result = await ensureS3Bucket(
      {
        async send(command) {
          commands.push(command.constructor.name);
          if (command instanceof HeadBucketCommand && headAttempts++ === 0) {
            throw new Error("NoSuchBucket");
          }
          return {};
        },
      },
      "ecs-media",
    );

    assert.deepEqual(result, { created: true, ok: true });
    assert.deepEqual(commands, [
      HeadBucketCommand.name,
      CreateBucketCommand.name,
      HeadBucketCommand.name,
    ]);
  });

  it("reports an unusable bucket instead of allowing dead media URLs", async () => {
    const result = await ensureS3Bucket(
      {
        async send() {
          throw new Error("storage unavailable");
        },
      },
      "ecs-media",
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.match(String(result.error), /storage unavailable/);
  });
});
