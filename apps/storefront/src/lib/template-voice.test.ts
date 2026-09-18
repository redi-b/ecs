import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTemplateVoiceMessage,
  templateVoiceMessageIds,
} from "./template-voice";

test("the template voice allowlist contains only safe merchandising actions", () => {
  assert.deepEqual(templateVoiceMessageIds, ["action_add_to_cart", "action_continue_shopping"]);
  assert.equal(templateVoiceMessageIds.includes("checkout_place_order" as never), false);
  assert.equal(templateVoiceMessageIds.includes("action_remove" as never), false);
});

test("Luvia resolves its approved voice while NexaHub uses the shared fallback", () => {
  assert.equal(
    resolveTemplateVoiceMessage({
      fallback: "Add to cart",
      locale: "en",
      messageId: "action_add_to_cart",
      templateKey: "luvia.v1",
    }),
    "Add to bag",
  );
  assert.equal(
    resolveTemplateVoiceMessage({
      fallback: "Add to cart",
      locale: "am",
      messageId: "action_add_to_cart",
      templateKey: "nexahub.v1",
    }),
    "Add to cart",
  );
});
