import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveEmailSenderConfiguration,
  validateEmailSenderConfiguration,
} from "./email-configuration.js";

describe("email sender configuration", () => {
  it("uses the legacy sender only as a profile fallback", () => {
    const configuration = resolveEmailSenderConfiguration({
      EMAIL_FROM: "ECS <mail@example.com>",
      EMAIL_FROM_ACCOUNTS: "Accounts <accounts@example.com>",
    });
    assert.equal(configuration.profiles.accounts, "Accounts <accounts@example.com>");
    assert.equal(configuration.profiles.orders, "ECS <mail@example.com>");
  });

  it("requires every logical profile in production", () => {
    assert.match(
      validateEmailSenderConfiguration({ env: {}, production: true }) ?? "",
      /accounts, notifications, billing, orders/,
    );
  });

  it("rejects malformed configured mailboxes", () => {
    assert.equal(
      validateEmailSenderConfiguration({ env: { EMAIL_FROM: "not-an-email" } }),
      "Email sender and reply addresses must be valid mailboxes",
    );
  });
});
