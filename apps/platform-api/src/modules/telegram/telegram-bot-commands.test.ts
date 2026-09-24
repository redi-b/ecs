import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_BOT_COMMANDS,
  OPERATOR_BOT_COMMANDS,
  deleteChatBotCommands,
  setDefaultBotCommands,
  setOperatorChatCommands,
} from "./telegram-bot-commands.js";

describe("telegram-bot-commands", () => {
  it("sets default scope commands", async () => {
    let called = 0;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      called += 1;
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.scope, { type: "default" });
      assert.deepEqual(body.commands, [...DEFAULT_BOT_COMMANDS]);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await setDefaultBotCommands({ botToken: "tok", fetchImpl: fetchImpl as unknown as typeof fetch });
    assert.equal(called, 1);
  });

  it("sets chat scope operator commands", async () => {
    let called = 0;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      called += 1;
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.scope, { type: "chat", chat_id: "99" });
      assert.deepEqual(body.commands, [...OPERATOR_BOT_COMMANDS]);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await setOperatorChatCommands({
      botToken: "tok",
      chatId: "99",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(called, 1);
  });

  it("deletes chat scope commands", async () => {
    let called = 0;
    const fetchImpl = async (url: string, init?: RequestInit) => {
      called += 1;
      assert.ok(String(url).includes("deleteMyCommands"));
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.scope, { type: "chat", chat_id: "99" });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await deleteChatBotCommands({
      botToken: "tok",
      chatId: "99",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(called, 1);
  });
});
