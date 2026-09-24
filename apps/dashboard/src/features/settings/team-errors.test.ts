import assert from "node:assert/strict";
import test from "node:test";
import { teamErrorKey } from "./team-errors";

test("explains existing membership and invitations without exposing server messages", () => {
  assert.equal(
    teamErrorKey(new Error("USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION")),
    "settings.team.alreadyMember",
  );
  assert.equal(
    teamErrorKey(new Error("USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION")),
    "settings.team.alreadyInvited",
  );
  assert.equal(teamErrorKey(new Error("internal database details")), null);
});
