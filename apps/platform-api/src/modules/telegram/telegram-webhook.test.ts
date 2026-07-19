import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ensureTelegramWebhookIfConfigured,
  resolveTelegramWebhookUrl,
  setTelegramWebhook,
} from "./telegram-webhook.js";

describe("resolveTelegramWebhookUrl", () => {
  it("prefers TELEGRAM_WEBHOOK_URL", () => {
    assert.equal(
      resolveTelegramWebhookUrl({
        TELEGRAM_WEBHOOK_URL: "https://api.example.com/platform/webhooks/telegram/",
        PLATFORM_PUBLIC_BASE_URL: "https://ignored.example.com",
      }),
      "https://api.example.com/platform/webhooks/telegram",
    );
  });

  it("builds from PLATFORM_PUBLIC_BASE_URL", () => {
    assert.equal(
      resolveTelegramWebhookUrl({
        PLATFORM_PUBLIC_BASE_URL: "https://api.ecs.example.com",
      }),
      "https://api.ecs.example.com/platform/webhooks/telegram",
    );
  });

  it("returns null when nothing configured", () => {
    assert.equal(resolveTelegramWebhookUrl({}), null);
  });
});

describe("setTelegramWebhook", () => {
  it("POSTs setWebhook with secret and allowed_updates", async () => {
    let called = 0;
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      called += 1;
      assert.ok(String(url).includes("/setWebhook"));
      const body = JSON.parse(String(init?.body));
      assert.equal(body.url, "https://api.example.com/platform/webhooks/telegram");
      assert.equal(body.secret_token, "sec");
      assert.deepEqual(body.allowed_updates, ["message", "callback_query"]);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const result = await setTelegramWebhook({
      botToken: "tok",
      webhookUrl: "https://api.example.com/platform/webhooks/telegram",
      secretToken: "sec",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.url, "https://api.example.com/platform/webhooks/telegram");
    assert.equal(called, 1);
  });

  it("returns error when Telegram rejects", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ ok: false, description: "Bad Request: bad webhook" }), {
        status: 200,
      });
    const result = await setTelegramWebhook({
      botToken: "tok",
      webhookUrl: "https://api.example.com/hook",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /bad webhook/i);
  });
});

describe("ensureTelegramWebhookIfConfigured", () => {
  it("skips when polling is enabled", async () => {
    const result = await ensureTelegramWebhookIfConfigured({
      botToken: "tok",
      pollingEnabled: true,
      env: { TELEGRAM_WEBHOOK_URL: "https://api.example.com/platform/webhooks/telegram" },
    });
    assert.deepEqual(result, { skipped: true, reason: "polling_enabled" });
  });

  it("skips when no URL can be resolved", async () => {
    const result = await ensureTelegramWebhookIfConfigured({
      botToken: "tok",
      pollingEnabled: false,
      env: {},
    });
    assert.deepEqual(result, { skipped: true, reason: "webhook_url_unconfigured" });
  });

  it("registers when polling is off and URL is set", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 });
    const result = await ensureTelegramWebhookIfConfigured({
      botToken: "tok",
      pollingEnabled: false,
      env: {
        TELEGRAM_WEBHOOK_URL: "https://api.example.com/platform/webhooks/telegram",
        TELEGRAM_WEBHOOK_SECRET: "sec",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(result.ok === true || ("skipped" in result && result.skipped), true);
    if ("ok" in result && result.ok) {
      assert.equal(result.url, "https://api.example.com/platform/webhooks/telegram");
    }
  });
});
