import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createEmailNotificationProviderFromEnv,
  type EmailProviderAdapter,
} from "./email-provider-factory.js";

test("returns no provider when email delivery is not configured", () => {
  assert.deepEqual(createEmailNotificationProviderFromEnv({}), {
    configured: false,
    name: null,
    provider: null,
  });
});

test("keeps legacy Resend configuration working without an explicit selector", () => {
  const resolution = createEmailNotificationProviderFromEnv({
    EMAIL_FROM: "alerts@example.com",
    RESEND_API_KEY: "re_test",
  });

  assert.equal(resolution.configured, true);
  assert.equal(resolution.name, "resend");
  assert.equal(resolution.provider?.channel, "email");
});

test("rejects an incomplete selected provider configuration", () => {
  assert.throws(
    () => createEmailNotificationProviderFromEnv({ EMAIL_PROVIDER: "resend" }),
    /requires RESEND_API_KEY and EMAIL_FROM/,
  );
});

test("selects an injected provider adapter without changing auth or notification code", () => {
  const provider = {
    channel: "email",
    async send() {
      return { providerReference: "custom:1" };
    },
  };
  const customAdapter: EmailProviderAdapter = {
    create: () => provider,
    name: "custom",
    validate: () => null,
  };

  const resolution = createEmailNotificationProviderFromEnv({ EMAIL_PROVIDER: "custom" }, [
    customAdapter,
  ]);

  assert.equal(resolution.name, "custom");
  assert.equal(resolution.provider, provider);
});
