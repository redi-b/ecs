import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

for (const file of ["caddy", "dokploy"]) {
  it(`routes brand assets to the dashboard on shop hosts (${file})`, () => {
    const source = readFileSync(
      new URL(`../../../../infra/${file}/Caddyfile`, import.meta.url),
      "utf8",
    );
    const matcher = source.match(
      /@dashboard_?Assets?\s+path[^\n]+|@dashboard_assets\s+path[^\n]+/i,
    )?.[0];
    assert.ok(matcher?.includes("/brand/*"));
  });
}
