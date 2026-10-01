import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupSettingsSections,
  SETTINGS_SECTION_IDS,
  searchSettingsSections,
} from "./settings-nav";

test("every existing settings destination appears exactly once in a merchant task group", () => {
  const groups = groupSettingsSections(SETTINGS_SECTION_IDS);
  const ids = groups.flatMap((group) => group.sections);
  assert.deepEqual(new Set(ids), new Set(SETTINGS_SECTION_IDS));
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual(groups.find((group) => group.id === "shop")?.sections, [
    "shop",
    "storefront",
    "domains",
  ]);
  assert.deepEqual(groups.find((group) => group.id === "selling")?.sections, [
    "payments",
    "fulfillment",
    "documents",
  ]);
});
test("permission filtering removes unavailable destinations and empty headings", () => {
  assert.deepEqual(groupSettingsSections(["account", "preferences"]), [
    { id: "account", sections: ["preferences", "account"] },
  ]);
  assert.deepEqual(groupSettingsSections([]), []);
  assert.deepEqual(groupSettingsSections(["team"]), [{ id: "team", sections: ["team"] }]);
});

test("settings search matches merchant tasks beyond labels and respects permissions", () => {
  const text = (id: string) => id;
  assert.deepEqual(searchSettingsSections("reset password", ["shop", "account"], text), [
    "account",
  ]);
  assert.deepEqual(searchSettingsSections("delivery fee", SETTINGS_SECTION_IDS, text), [
    "fulfillment",
  ]);
  assert.deepEqual(searchSettingsSections("dns", ["shop", "account"], text), []);
  assert.deepEqual(searchSettingsSections("የይለፍ ቃል", SETTINGS_SECTION_IDS, text), ["account"]);
  assert.deepEqual(searchSettingsSections("", ["shop", "account"], text), ["shop", "account"]);
});
