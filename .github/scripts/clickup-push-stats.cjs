const EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const FULL_SHA = /^[0-9a-f]{40}$/i;

function parseShortStat(output) {
  const text = String(output || "").trim();
  if (!text) return { additions: 0, deletions: 0, filesChanged: 0 };
  return {
    additions: Number(/(\d+) insertions?\(\+\)/.exec(text)?.[1] || 0),
    deletions: Number(/(\d+) deletions?\(-\)/.exec(text)?.[1] || 0),
    filesChanged: Number(/(\d+) files? changed/.exec(text)?.[1] || 0),
  };
}

async function resolveFirstParent(after, exec) {
  const parent = await exec.getExecOutput("git", ["rev-parse", `${after}^1`], {
    ignoreReturnCode: true,
    silent: true,
  });
  return parent.exitCode === 0 && FULL_SHA.test(parent.stdout.trim())
    ? parent.stdout.trim()
    : EMPTY_TREE_SHA;
}

async function runNetDiff(base, after, exec) {
  return exec.getExecOutput("git", ["diff", "--shortstat", "--find-renames", base, after, "--"], {
    env: { ...process.env, LC_ALL: "C" },
    ignoreReturnCode: true,
    silent: true,
  });
}

async function resolvePushStats(event, head, exec, core) {
  const after = FULL_SHA.test(event.after || "") ? event.after : head.id;
  if (!FULL_SHA.test(after)) {
    core.warning("Push payload does not contain a valid after SHA; net stats are unavailable.");
    return { available: false, additions: 0, deletions: 0, filesChanged: 0 };
  }

  // GitHub's commit page compares a commit to its first parent. Matching that
  // range keeps the notification totals identical to the commit we link to,
  // including merge commits. Root commits are compared with the empty tree.
  const before = await resolveFirstParent(after, exec);
  const result = await runNetDiff(before, after, exec);

  if (result.exitCode !== 0) {
    core.warning(
      `Could not calculate net push stats for ${before.slice(0, 7)}..${after.slice(0, 7)}.`,
    );
    return { available: false, additions: 0, deletions: 0, filesChanged: 0 };
  }
  return { available: true, ...parseShortStat(result.stdout) };
}

module.exports = { parseShortStat, resolvePushStats };
