const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  formatPushTitle,
  parseShortStat,
  resolveAuthorTag,
  resolveCommitStats,
  resolvePushStats,
} = require("./clickup-push-stats.cjs");

const BEFORE = "1".repeat(40);
const AFTER = "2".repeat(40);
const PARENT = "3".repeat(40);

describe("ClickUp push stats", () => {
  it("parses Git shortstat output", () => {
    assert.deepEqual(parseShortStat(" 3 files changed, 14 insertions(+), 6 deletions(-)"), {
      additions: 14,
      deletions: 6,
      filesChanged: 3,
    });
    assert.deepEqual(parseShortStat(" 1 file changed, 1 insertion(+)"), {
      additions: 1,
      deletions: 0,
      filesChanged: 1,
    });
    assert.deepEqual(parseShortStat(""), { additions: 0, deletions: 0, filesChanged: 0 });
  });

  it("matches the linked commit's first-parent diff", async () => {
    const calls = [];
    const exec = {
      async getExecOutput(command, args) {
        calls.push([command, args]);
        if (args[0] === "rev-parse") return { exitCode: 0, stdout: `${PARENT}\n` };
        return { exitCode: 0, stdout: " 2 files changed, 8 insertions(+), 3 deletions(-)" };
      },
    };
    const result = await resolvePushStats(
      { after: AFTER, before: BEFORE, commits: [{ id: AFTER }] },
      { id: AFTER },
      exec,
      { warning() {} },
    );
    assert.deepEqual(result, {
      additions: 8,
      available: true,
      deletions: 3,
      filesChanged: 2,
    });
    assert.deepEqual(calls, [
      ["git", ["rev-parse", `${AFTER}^1`]],
      ["git", ["diff", "--shortstat", "--find-renames", PARENT, AFTER, "--"]],
    ]);
  });

  it("uses the empty tree for a root commit", async () => {
    const calls = [];
    const exec = {
      async getExecOutput(command, args) {
        calls.push([command, args]);
        if (args[0] === "rev-parse") return { exitCode: 128, stdout: "" };
        return { exitCode: 0, stdout: " 1 file changed, 2 insertions(+)" };
      },
    };
    const result = await resolvePushStats(
      { after: AFTER, before: "0".repeat(40), commits: [{ id: AFTER }] },
      { id: AFTER },
      exec,
      { warning() {} },
    );
    assert.equal(result.available, true);
    assert.deepEqual(calls[0], ["git", ["rev-parse", `${AFTER}^1`]]);
    assert.deepEqual(calls[1], [
      "git",
      [
        "diff",
        "--shortstat",
        "--find-renames",
        "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
        AFTER,
        "--",
      ],
    ]);
  });

  it("reports unavailable stats instead of misleading zeroes after a failed diff", async () => {
    const warnings = [];
    const exec = {
      async getExecOutput(_command, args) {
        if (args[0] === "rev-parse") return { exitCode: 0, stdout: `${PARENT}\n` };
        return { exitCode: 1, stdout: "" };
      },
    };
    const result = await resolvePushStats(
      { after: AFTER, before: BEFORE, commits: [] },
      { id: AFTER },
      exec,
      { warning: (message) => warnings.push(message) },
    );
    assert.equal(result.available, false);
    assert.equal(warnings.length, 1);
  });

  it("resolves first-parent stats for every commit in a multi-commit push", async () => {
    const second = "4".repeat(40);
    const calls = [];
    const exec = {
      async getExecOutput(_command, args) {
        calls.push(args);
        if (args[0] === "rev-parse") {
          return { exitCode: 0, stdout: `${args[1].startsWith(AFTER) ? PARENT : AFTER}\n` };
        }
        return {
          exitCode: 0,
          stdout:
            args.at(-2) === AFTER
              ? " 2 files changed, 8 insertions(+), 3 deletions(-)"
              : " 1 file changed, 2 insertions(+)",
        };
      },
    };

    const results = await resolveCommitStats([{ id: AFTER }, { id: second }], exec, {
      warning() {},
    });

    assert.deepEqual(results, [
      {
        id: AFTER,
        stats: { additions: 8, available: true, deletions: 3, filesChanged: 2 },
      },
      {
        id: second,
        stats: { additions: 2, available: true, deletions: 0, filesChanged: 1 },
      },
    ]);
    assert.equal(calls.filter((args) => args[0] === "rev-parse").length, 2);
    assert.equal(calls.filter((args) => args[0] === "diff").length, 2);
  });

  it("resolves author tags correctly for known authors", () => {
    assert.equal(resolveAuthorTag("redi-b"), "by _Rediet Berhanu_");
    assert.equal(resolveAuthorTag("redytron"), "by _Rediet Berhanu_");
    assert.equal(resolveAuthorTag("Rediet Berhanu"), "by _Rediet Berhanu_");
    assert.equal(resolveAuthorTag("Hosea174"), "by _Hossaena Berhan_");
    assert.equal(resolveAuthorTag("hossaena"), "by _Hossaena Berhan_");
    assert.equal(resolveAuthorTag("Hossaena Berhan"), "by _Hossaena Berhan_");
    assert.equal(resolveAuthorTag("someone-else"), "");
    assert.equal(resolveAuthorTag(null), "");
    assert.equal(resolveAuthorTag(undefined), "");
  });

  it("formats push notification title with author tag when known or without tag when unknown", () => {
    assert.equal(
      formatPushTitle("redi-b/ecs", "redi-b"),
      "**🚀 New Push by _Rediet Berhanu_ — redi-b/ecs**",
    );
    assert.equal(
      formatPushTitle("redi-b/ecs", "Hosea174"),
      "**🚀 New Push by _Hossaena Berhan_ — redi-b/ecs**",
    );
    assert.equal(formatPushTitle("redi-b/ecs", "octocat"), "**🚀 New Push — redi-b/ecs**");
    assert.equal(formatPushTitle("redi-b/ecs", null), "**🚀 New Push — redi-b/ecs**");
  });
});
