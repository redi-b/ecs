const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { parseShortStat, resolvePushStats } = require("./clickup-push-stats.cjs");

const BEFORE = "1".repeat(40);
const AFTER = "2".repeat(40);
const FIRST = "3".repeat(40);
const PARENT = "4".repeat(40);

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

  it("calculates one net diff for the entire push instead of summing commit churn", async () => {
    const calls = [];
    const exec = {
      async getExecOutput(command, args) {
        calls.push([command, args]);
        return { exitCode: 0, stdout: " 2 files changed, 8 insertions(+), 3 deletions(-)" };
      },
    };
    const result = await resolvePushStats(
      { after: AFTER, before: BEFORE, commits: [{ id: FIRST }, { id: AFTER }] },
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
      ["git", ["diff", "--shortstat", "--find-renames", BEFORE, AFTER, "--"]],
    ]);
  });

  it("uses the oldest pushed commit's parent for a new branch", async () => {
    const calls = [];
    const exec = {
      async getExecOutput(command, args) {
        calls.push([command, args]);
        if (args[0] === "rev-parse") return { exitCode: 0, stdout: `${PARENT}\n` };
        return { exitCode: 0, stdout: " 1 file changed, 2 insertions(+)" };
      },
    };
    const result = await resolvePushStats(
      { after: AFTER, before: "0".repeat(40), commits: [{ id: FIRST }, { id: AFTER }] },
      { id: AFTER },
      exec,
      { warning() {} },
    );
    assert.equal(result.available, true);
    assert.deepEqual(calls[0], ["git", ["rev-parse", `${FIRST}^`]]);
    assert.deepEqual(calls[1], [
      "git",
      ["diff", "--shortstat", "--find-renames", PARENT, AFTER, "--"],
    ]);
  });

  it("reports unavailable stats instead of misleading zeroes after a failed diff", async () => {
    const warnings = [];
    const exec = {
      async getExecOutput() {
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
});
