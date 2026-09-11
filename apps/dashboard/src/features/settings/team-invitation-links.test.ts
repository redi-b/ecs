import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { invitationUrl, telegramInvitationShareUrl } from "./team-invitation-links";

describe("team invitation links", () => {
  it("uses the dashboard acceptance host rather than the current shop host", () => {
    assert.equal(
      invitationUrl("https://app.example.com", "invite /+?"),
      "https://app.example.com/accept-invitation?invitationId=invite+%2F%2B%3F",
    );
    assert.notEqual(
      invitationUrl("https://app.example.com", "invite_1"),
      "https://shop.example.com/accept-invitation?invitationId=invite_1",
    );
  });

  it("keeps the invited shop in the acceptance link", () => {
    assert.equal(
      invitationUrl("https://app.example.com", "invite_1", "tenant_2"),
      "https://app.example.com/accept-invitation?invitationId=invite_1&tenantId=tenant_2",
    );
  });

  it("encodes the invite and message for Telegram's share picker", () => {
    const share = new URL(
      telegramInvitationShareUrl(
        "https://app.example.com/accept-invitation?invitationId=invite_1",
        "Join my shop on ECS.",
      ),
    );
    assert.equal(share.origin, "https://t.me");
    assert.equal(share.pathname, "/share/url");
    assert.equal(
      share.searchParams.get("url"),
      "https://app.example.com/accept-invitation?invitationId=invite_1",
    );
    assert.equal(share.searchParams.get("text"), "Join my shop on ECS.");
  });
});
