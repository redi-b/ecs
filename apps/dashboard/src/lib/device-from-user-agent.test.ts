import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseDeviceFromUserAgent } from "./device-from-user-agent.js";

describe("parseDeviceFromUserAgent", () => {
  it("detects iPhone Safari", () => {
    const info = parseDeviceFromUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    );
    assert.equal(info.form, "phone");
    assert.equal(info.deviceLabel, "iPhone");
    assert.match(info.os, /^iOS 17/);
    assert.equal(info.browser, "Safari");
  });

  it("detects Android Chrome phone", () => {
    const info = parseDeviceFromUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    );
    assert.equal(info.form, "phone");
    assert.equal(info.deviceLabel, "Android phone");
    assert.match(info.os, /^Android 14/);
    assert.equal(info.browser, "Chrome");
  });

  it("does not label node/undici fetch as desktop", () => {
    const info = parseDeviceFromUserAgent("node");
    assert.equal(info.form, "unknown");
    assert.equal(info.deviceLabel, "Unknown device");
    assert.equal(info.os, "Unknown OS");
  });

  it("handles empty UA as unknown", () => {
    const info = parseDeviceFromUserAgent(null);
    assert.equal(info.form, "unknown");
    assert.equal(info.deviceLabel, "Unknown device");
  });
});
