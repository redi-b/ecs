import assert from "node:assert/strict";
import test from "node:test";
import { serializeJsonForScript } from "./serialize-json";

test("merchant text cannot close embedded JSON scripts and round-trips unchanged", () => {
  const value = {
    title: "</script><script>alert(1)</script>",
    option: "A&B",
    line: "\u2028\u2029",
  };
  const serialized = serializeJsonForScript(value);
  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes("&"), false);
  assert.deepEqual(JSON.parse(serialized), value);
});
