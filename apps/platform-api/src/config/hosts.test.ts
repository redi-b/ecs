import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSystemHosts } from "./hosts.js";

describe("getSystemHosts", () => {
  it("extracts hostnames from configured public URLs", () => {
    assert.deepEqual(
      getSystemHosts({
        PLATFORM_PUBLIC_BASE_URL: "http://api.lvh.me",
        DASHBOARD_PUBLIC_BASE_URL: "http://dashboard.lvh.me",
      }),
      ["api.lvh.me", "dashboard.lvh.me"],
    );
  });

  it("ignores missing and invalid URLs", () => {
    assert.deepEqual(
      getSystemHosts({
        PLATFORM_PUBLIC_BASE_URL: "not a url",
      }),
      [],
    );
  });
});
