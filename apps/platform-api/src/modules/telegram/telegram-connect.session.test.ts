/**
 * Notification connect: /start TOKEN session lookup and consume messaging.
 * Telegram HTTP is mocked; DB is a small sequential responder matching drizzle await chains.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTelegramConnectService, parseTelegramStartPayload } from "./telegram-connect.js";

describe("telegram connect /start payload", () => {
  it("extracts start tokens", () => {
    assert.equal(parseTelegramStartPayload("/start abcd1234"), "abcd1234");
    assert.equal(parseTelegramStartPayload("/start@MyBot op_deadbeef"), "op_deadbeef");
    assert.equal(parseTelegramStartPayload("/start"), null);
  });
});

function mockTelegramFetch(sent: string[]) {
  return async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("sendMessage")) {
      const body = JSON.parse(String(init?.body));
      sent.push(String(body.text));
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
}

/**
 * Queue of results for each awaited query. Supports:
 * - await select().from().where().limit(n)
 * - await select().from().where()  (count)
 * - insert().values()
 * - update().set().where()
 */
function createQueuedDb(queue: unknown[][]) {
  let qi = 0;
  const next = () => {
    const rows = queue[qi] ?? [];
    qi += 1;
    return rows;
  };

  const limitResult = () => {
    const rows = next();
    return {
      limit: async (_n: number) => rows,
      then(resolve: (v: unknown) => void) {
        resolve(rows);
      },
    };
  };

  return {
    select(_shape?: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_cond: unknown) {
              return limitResult();
            },
            limit: async (_n: number) => next(),
          };
        },
      };
    },
    insert(_table: unknown) {
      return {
        values: async (_row: unknown) => undefined,
      };
    },
    update(_table: unknown) {
      return {
        set(_patch: unknown) {
          return {
            where: async (_cond: unknown) => undefined,
          };
        },
      };
    },
  };
}

describe("telegram connect session consume", () => {
  it("rejects unknown token", async () => {
    const sent: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockTelegramFetch(sent) as typeof fetch;

    try {
      // findConnectSessionByToken → empty
      const db = createQueuedDb([[]]);
      const service = createTelegramConnectService(db as never, {
        botToken: "tok",
        botUsername: "test_bot",
      });

      const result = await service.handleWebhookUpdate({
        message: {
          chat: { id: 42, type: "private" },
          from: { id: 42, username: "merchant" },
          text: "/start deadbeefdeadbeefdeadbeefdeadbeef",
        },
      });

      assert.equal(result.handled, true);
      assert.equal(result.reason, "invalid_token");
      assert.ok(sent.some((t) => /no longer valid/i.test(t)));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("consumes a pending session and confirms connection", async () => {
    const sent: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockTelegramFetch(sent) as typeof fetch;

    const session = {
      id: "sess_1",
      token: "aabbccddeeff00112233445566778899",
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    // Order of awaits in handleWebhookUpdate (notification path):
    // 1. find session (limit)
    // 2. count destinations (where thenable)
    // 3. existing same chat (limit)
    // 4. sample events (limit)
    // 5. insert destination
    // 6. update session consumed
    // 7. tenant name (limit)
    const db = createQueuedDb([
      [session],
      [{ value: 0 }],
      [],
      [],
      [{ name: "Bole Style" }],
    ]);

    try {
      const service = createTelegramConnectService(db as never, {
        botToken: "tok",
        botUsername: "test_bot",
      });

      const result = await service.handleWebhookUpdate({
        message: {
          chat: { id: 99, type: "private" },
          from: { id: 99, username: "merchant", first_name: "Abebe" },
          text: `/start ${session.token}`,
        },
      });

      assert.equal(result.handled, true);
      assert.equal(result.reason, "connected");
      assert.ok(sent.some((t) => /Connected to Bole Style/i.test(t)));
      assert.ok(sent.some((t) => /merchant alerts/i.test(t)));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects expired pending sessions", async () => {
    const sent: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockTelegramFetch(sent) as typeof fetch;

    const session = {
      id: "sess_exp",
      token: "ffffffffffffffffffffffffffffffff",
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
    };

    // find session, then update expired
    const db = createQueuedDb([[session]]);

    try {
      const service = createTelegramConnectService(db as never, {
        botToken: "tok",
        botUsername: "test_bot",
      });

      const result = await service.handleWebhookUpdate({
        message: {
          chat: { id: 7, type: "private" },
          from: { id: 7 },
          text: `/start ${session.token}`,
        },
      });

      assert.equal(result.handled, true);
      assert.equal(result.reason, "expired_token");
      assert.ok(sent.some((t) => /expired/i.test(t)));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
