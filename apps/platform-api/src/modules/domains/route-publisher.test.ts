import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { createDomainRoutePublisher } from "./route-publisher.js";

it("repairs an owned interrupted publication from fresh desired state, never a stale checkpoint", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecs-route-publisher-"));
  try {
    await createDomainRoutePublisher({ directory }).publish("old active domain", async () => {});
    const moduleUrl = new URL("./route-publisher.ts", import.meta.url).href;
    // A real process exits after the live rename but before acknowledgement.
    // Restart does not depend on in-memory flags or injected filesystem mocks.
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      import { createDomainRoutePublisher } from ${JSON.stringify(moduleUrl)};
      await createDomainRoutePublisher({ directory: ${JSON.stringify(directory)} })
        .publish("interrupted active domain", async () => process.exit(0));
    `,
      ],
      { stdio: "pipe" },
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      "interrupted active domain",
    );
    const restarted = createDomainRoutePublisher({ directory });
    await assert.rejects(
      restarted.publish("empty desired state after removal", async () => {
        throw new Error("provider still unavailable");
      }),
      /provider still unavailable/,
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      "empty desired state after removal",
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.last-good"), "utf8"),
      "old active domain",
    );
    await restarted.publish("empty desired state after removal", async () => {
      assert.equal(
        await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
        "empty desired state after removal",
      );
    });
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.last-good"), "utf8"),
      "empty desired state after removal",
    );
    assert.deepEqual((await readdir(directory)).sort(), [
      "ecs-custom-domains.last-good",
      "ecs-custom-domains.yml",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("publishes a complete route snapshot and skips identical replacements without touching ACME", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecs-route-publisher-"));
  try {
    await writeFile(join(directory, "acme.json"), "private certificate state");
    const publisher = createDomainRoutePublisher({ directory });
    const content =
      "http:\n  middlewares:\n    redirect:\n      redirectScheme:\n        scheme: https\n";
    const verify = async () => {
      assert.equal(await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"), content);
    };
    assert.deepEqual(await publisher.publish(content, verify), { changed: true });
    assert.deepEqual(await publisher.publish(content, verify), { changed: false });
    assert.equal(await readFile(join(directory, "acme.json"), "utf8"), "private certificate state");
    assert.equal(await readFile(join(directory, "ecs-custom-domains.last-good"), "utf8"), content);
    assert.deepEqual((await readdir(directory)).sort(), [
      "acme.json",
      "ecs-custom-domains.last-good",
      "ecs-custom-domains.yml",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("never overwrites a newer external snapshot during failure rollback", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecs-route-publisher-"));
  try {
    const publisher = createDomainRoutePublisher({ directory });
    await publisher.publish("accepted", async () => {});
    await assert.rejects(
      publisher.publish("candidate", async () => {
        await writeFile(join(directory, "ecs-custom-domains.yml"), "external removal snapshot");
        throw new Error("Lost exclusive ownership");
      }),
      AggregateError,
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      "external removal snapshot",
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.last-good"), "utf8"),
      "accepted",
    );
    await assert.rejects(
      createDomainRoutePublisher({ directory }).publish("fresh desired", async () => {}),
      /journal does not match/,
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      "external removal snapshot",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects symlinked owned files without reading or replacing certificate storage", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecs-route-publisher-"));
  try {
    await writeFile(join(directory, "acme.json"), "private certificate state");
    await symlink(join(directory, "acme.json"), join(directory, "ecs-custom-domains.yml"));
    const publisher = createDomainRoutePublisher({ directory });
    await assert.rejects(
      publisher.publish("candidate", async () => {}),
      /regular file/,
    );
    assert.equal(await readFile(join(directory, "acme.json"), "utf8"), "private certificate state");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("withdraws a rejected first publication without inventing a last-known-good snapshot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecs-route-publisher-"));
  try {
    const publisher = createDomainRoutePublisher({ directory });
    await assert.rejects(
      publisher.publish("first snapshot", async () => {
        throw new Error("Reload unavailable");
      }),
      /Reload unavailable/,
    );
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("fails closed on an unacknowledged snapshot after interruption instead of adopting it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecs-route-publisher-"));
  try {
    await writeFile(join(directory, "ecs-custom-domains.yml"), "unacknowledged snapshot");
    const publisher = createDomainRoutePublisher({ directory });
    await assert.rejects(
      publisher.publish("new snapshot", async () => {}),
      /Unacknowledged/,
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      "unacknowledged snapshot",
    );
    assert.deepEqual(await readdir(directory), ["ecs-custom-domains.yml"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("restores the last accepted snapshot when live reload verification rejects a replacement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecs-route-publisher-"));
  try {
    const publisher = createDomainRoutePublisher({ directory });
    await publisher.publish("accepted snapshot", async () => {});
    await assert.rejects(
      publisher.publish("rejected snapshot", async () => {
        assert.equal(
          await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
          "rejected snapshot",
        );
        throw new Error("Live provider rejected configuration");
      }),
      /Live provider rejected/,
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      "accepted snapshot",
    );
    assert.equal(
      await readFile(join(directory, "ecs-custom-domains.last-good"), "utf8"),
      "accepted snapshot",
    );
    const restartedPublisher = createDomainRoutePublisher({ directory });
    assert.deepEqual(await restartedPublisher.publish("accepted snapshot", async () => {}), {
      changed: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
