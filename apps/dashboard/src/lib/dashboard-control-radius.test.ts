import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";

const sourceRoot = new URL("../", import.meta.url);
const nonPillRadius = /rounded-(?:sm|md|lg|xl)(?:\b|!)/;
const standardControl = /<(?:Button|Input|InputGroup)\b[\s\S]*?>/g;

test("standard dashboard controls do not override the shared pill radius", async () => {
  const violations: string[] = [];

  for (const file of await sourceFiles(sourceRoot.pathname)) {
    if (file.endsWith("dashboard-control-radius.test.ts")) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(standardControl)) {
      if (!nonPillRadius.test(match[0])) continue;
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${file.slice(sourceRoot.pathname.length)}:${line}`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Use the shared pill radius for Button, Input, and InputGroup controls: ${violations.join(", ")}`,
  );
});

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(path));
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}
