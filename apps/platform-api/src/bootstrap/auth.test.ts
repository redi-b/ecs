import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGoogleAuthConfiguration } from "./auth.js";

describe("Google OAuth startup configuration", () => {
  it("auto-enables when both credentials are present", () => {
    assert.deepEqual(
      resolveGoogleAuthConfiguration({
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
      }),
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        enabled: true,
        status: "enabled",
      },
    );
  });

  it("allows Google OAuth to be explicitly disabled", () => {
    assert.deepEqual(
      resolveGoogleAuthConfiguration({
        GOOGLE_AUTH_ENABLED: "false",
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
      }),
      { enabled: false, status: "disabled" },
    );
  });

  it("rejects enabled or partial configuration without both credentials", () => {
    assert.throws(
      () => resolveGoogleAuthConfiguration({ GOOGLE_AUTH_ENABLED: "true" }),
      /GOOGLE_AUTH_ENABLED is true/,
    );
    assert.throws(
      () => resolveGoogleAuthConfiguration({ GOOGLE_CLIENT_ID: "client-id" }),
      /must be configured together/,
    );
  });
});
