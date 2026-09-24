import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { claimNotificationPollLease, createNotificationPollOwner } from "./notification-sync";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("notification polling lease", () => {
  it("allows one tab to lead until its lease expires", () => {
    const storage = memoryStorage();
    assert.equal(claimNotificationPollLease(storage, "tab-a", 100, 50), true);
    assert.equal(claimNotificationPollLease(storage, "tab-b", 120, 50), false);
    assert.equal(claimNotificationPollLease(storage, "tab-b", 151, 50), true);
  });

  it("allows the leader to renew its lease", () => {
    const storage = memoryStorage();
    assert.equal(claimNotificationPollLease(storage, "tab-a", 100, 50), true);
    assert.equal(claimNotificationPollLease(storage, "tab-a", 120, 50), true);
    assert.equal(claimNotificationPollLease(storage, "tab-b", 160, 50), false);
  });
});

describe("notification polling owner", () => {
  it("uses randomUUID when the browser provides it", () => {
    const owner = createNotificationPollOwner({
      getRandomValues: ((array: Uint32Array) => array) as Crypto["getRandomValues"],
      randomUUID: () => "tab-uuid" as `${string}-${string}-${string}-${string}-${string}`,
    });
    assert.equal(owner, "tab-uuid");
  });

  it("supports browsers without randomUUID", () => {
    const owner = createNotificationPollOwner({
      getRandomValues: ((array: Uint32Array) => {
        array.set([1, 2, 3, 4]);
        return array;
      }) as Crypto["getRandomValues"],
    });
    assert.equal(owner, "1-2-3-4");
  });
});
