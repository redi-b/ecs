import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function clientFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return clientFiles(file);
      if (!entry.name.endsWith(".tsx")) return [];
      const source = await readFile(file, "utf8");
      return source.startsWith('"use client"') ? [file] : [];
    }),
  );
  return files.flat();
}

test("client components use the Firefox-compatible client id helper", async () => {
  const files = await clientFiles(path.resolve("src"));
  const offenders: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/\bcrypto\.randomUUID\s*\(/u.test(source))
      offenders.push(path.relative(process.cwd(), file));
  }

  assert.deepEqual(offenders, []);
});
