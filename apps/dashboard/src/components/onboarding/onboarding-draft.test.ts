import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  writeOnboardingDraft,
} from "./onboarding-draft";

test("onboarding recovery restores only the current account's local draft", () => {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
  const now = Date.UTC(2026, 9, 1);
  writeOnboardingDraft(storage, "owner-a", { shopName: "First shop" }, now);
  assert.deepEqual(readOnboardingDraft(storage, "owner-a", now), { shopName: "First shop" });
  assert.equal(readOnboardingDraft(storage, "owner-b", now), null);
  assert.equal(readOnboardingDraft(storage, null, now), null);
});

test("expired, corrupt, future and ownerless legacy drafts are never recovered", () => {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
  const now = Date.UTC(2026, 9, 1);
  items.set("ecs:onboarding-draft", JSON.stringify({ shopName: "Unknown owner" }));
  assert.equal(readOnboardingDraft(storage, "owner-a", now), null);
  assert.equal(items.has("ecs:onboarding-draft"), false);
  writeOnboardingDraft(storage, "owner-a", { shopName: "Expired" }, now);
  assert.equal(readOnboardingDraft(storage, "owner-a", now + 31 * 86400000), null);
  assert.equal(items.has("ecs:onboarding-draft:owner-a"), false);
  items.set("ecs:onboarding-draft:owner-a", "{");
  assert.equal(readOnboardingDraft(storage, "owner-a", now), null);
  writeOnboardingDraft(storage, "owner-a", { shopName: "Future" }, now + 1000);
  assert.equal(readOnboardingDraft(storage, "owner-a", now), null);
  writeOnboardingDraft(storage, "owner-a", { shopName: "One" }, now);
  writeOnboardingDraft(storage, "owner-b", { shopName: "Two" }, now);
  clearOnboardingDraft(storage, "owner-a");
  assert.equal(readOnboardingDraft(storage, "owner-a", now), null);
  assert.deepEqual(readOnboardingDraft(storage, "owner-b", now), { shopName: "Two" });
});

test("blocked browser storage does not throw or prevent setup", () => {
  const blocked = () => {
    throw new Error("Storage blocked");
  };
  const storage = { getItem: blocked, setItem: blocked, removeItem: blocked };
  assert.equal(readOnboardingDraft(storage, "owner-a"), null);
  assert.doesNotThrow(() => writeOnboardingDraft(storage, "owner-a", {}));
  assert.doesNotThrow(() => clearOnboardingDraft(storage, "owner-a"));
});
