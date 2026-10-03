import assert from "node:assert/strict";
import { it } from "node:test";

import { resolveTelegramAuthConfiguration } from "./telegram-auth.js";

it("keeps Telegram auth unavailable when credentials are absent in auto mode", () => {
  assert.deepEqual(resolveTelegramAuthConfiguration({}), {
    enabled: false,
    status: "not_configured",
  });
});

it("enables Telegram auth only when both OIDC credentials are present", () => {
  assert.deepEqual(
    resolveTelegramAuthConfiguration({
      TELEGRAM_AUTH_CLIENT_ID: "123456789",
      TELEGRAM_AUTH_CLIENT_SECRET: "secret",
    }),
    {
      clientId: "123456789",
      clientSecret: "secret",
      enabled: true,
      status: "enabled",
    },
  );
});

it("rejects a partial Telegram credential pair", () => {
  assert.throws(
    () => resolveTelegramAuthConfiguration({ TELEGRAM_AUTH_CLIENT_ID: "123456789" }),
    /must be configured together/,
  );
});

it("allows operators to disable configured Telegram auth", () => {
  assert.deepEqual(
    resolveTelegramAuthConfiguration({
      TELEGRAM_AUTH_CLIENT_ID: "123456789",
      TELEGRAM_AUTH_CLIENT_SECRET: "secret",
      TELEGRAM_AUTH_ENABLED: "false",
    }),
    { enabled: false, status: "disabled" },
  );
});
