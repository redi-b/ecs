import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultProfileAvatar,
  parseProfileAvatar,
  serializedProfileAvatarSchema,
} from "@ecs/contracts";
import { profileAvatarDataUri, profileInitial } from "./profile-avatar";

test("avatars are stable and personalization changes the result", () => {
  const first = profileAvatarDataUri("user1", "Liya", defaultProfileAvatar);
  assert.equal(first, profileAvatarDataUri("user1", "Liya", defaultProfileAvatar));
  assert.notEqual(first, profileAvatarDataUri("user2", "Liya", defaultProfileAvatar));
  assert.notEqual(
    first,
    profileAvatarDataUri("user1", "Liya", { ...defaultProfileAvatar, variation: 1 }),
  );
  assert.notEqual(
    first,
    profileAvatarDataUri("user1", "Liya", { ...defaultProfileAvatar, color: "mint" }),
  );
  assert.notEqual(
    first,
    profileAvatarDataUri("user1", "Liya", { ...defaultProfileAvatar, eyes: "variant08" }),
  );
  assert.notEqual(
    first,
    profileAvatarDataUri("user1", "Liya", { ...defaultProfileAvatar, angle: "left" }),
  );
});

test("monograms support Ethiopic names and empty fallback", () => {
  assert.equal(profileInitial("  ሊያ  "), "ሊ");
  assert.equal(profileInitial(""), "?");
  assert.match(decodeURIComponent(profileAvatarDataUri("user1", "ሊያ")), /ሊ/);
});

test("preferences reject unknown versions, keys and arbitrary colors", () => {
  assert.deepEqual(parseProfileAvatar(JSON.stringify(defaultProfileAvatar)), defaultProfileAvatar);
  for (const value of [
    "broken",
    { ...defaultProfileAvatar, version: 2 },
    { ...defaultProfileAvatar, color: "url(x)" },
    { ...defaultProfileAvatar, svg: "x" },
    { ...defaultProfileAvatar, variation: -1 },
  ]) {
    assert.equal(parseProfileAvatar(value), null);
  }
});

test("preferences from the first editor revision receive safe eye and angle defaults", () => {
  assert.deepEqual(parseProfileAvatar({ version: 1, color: "sky", variation: 4 }), {
    version: 1,
    color: "sky",
    variation: 4,
    eyes: "auto",
    angle: "straight",
  });
});

test("the untouched default chooses a stable expression per account", () => {
  const userOne = profileAvatarDataUri("user1", "Liya", defaultProfileAvatar);
  const userTwo = profileAvatarDataUri("user2", "Liya", defaultProfileAvatar);
  assert.equal(userOne, profileAvatarDataUri("user1", "Liya", defaultProfileAvatar));
  assert.notEqual(userOne, userTwo);
  assert.notEqual(
    userOne,
    profileAvatarDataUri("user1", "Liya", { ...defaultProfileAvatar, eyes: "variant01" }),
  );
});

test("changing the initial does not change the face geometry", () => {
  const liya = decodeURIComponent(profileAvatarDataUri("stable-user", "Liya"));
  const meron = decodeURIComponent(profileAvatarDataUri("stable-user", "Meron"));
  assert.equal(liya.replaceAll(">L<", ">INITIAL<"), meron.replaceAll(">M<", ">INITIAL<"));
  assert.ok(!liya.includes("stable-user"));
});

test("the direct auth field validator rejects unbounded or malformed configuration", () => {
  assert.equal(
    serializedProfileAvatarSchema.safeParse(JSON.stringify(defaultProfileAvatar)).success,
    true,
  );
  for (const value of [
    "null",
    "{}",
    "x".repeat(151),
    JSON.stringify({ ...defaultProfileAvatar, variation: 1000000 }),
    JSON.stringify({ ...defaultProfileAvatar, url: "https://example.com/avatar" }),
  ]) {
    assert.equal(serializedProfileAvatarSchema.safeParse(value).success, false);
  }
});
