import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nexahubV1Defaults, nexahubV1ThemeTokens } from "@ecs/storefront-templates";
import {
  clearPendingDraft,
  clearPendingTranslations,
  getPendingDraftStorageKey,
  getPendingTranslationsStorageKey,
  loadPendingDraft,
  loadPendingTranslations,
  savePendingDraft,
  savePendingTranslations,
} from "./editor-storage.js";
import {
  buildEditorData,
  serializeEditorData,
  updateLocalizedTranslation,
} from "./editor-state.js";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("storefront editor storage", () => {
  it("saves, loads, and clears pending editor drafts", () => {
    const storage = createMockStorage();
    const tenantId = "tenant_test_123";
    const templateKey = "nexahub@1";

    const initial = buildEditorData({
      data: structuredClone(nexahubV1Defaults),
      templateKey,
      templateVersion: 1,
      tenantId,
      themeTokens: structuredClone(nexahubV1ThemeTokens),
      updatedAt: "2026-09-17T00:00:00.000Z",
    });

    const edited = updateLocalizedTranslation(initial, "home.hero.title", "Pending Title");

    // Initially empty
    assert.equal(loadPendingDraft(tenantId, templateKey, storage), null);

    // Save pending draft
    savePendingDraft(tenantId, templateKey, edited, storage);

    // Check storage key
    const raw = storage.getItem(getPendingDraftStorageKey(tenantId, templateKey));
    assert.ok(raw);

    // Load pending draft
    const loaded = loadPendingDraft(tenantId, templateKey, storage);
    assert.ok(loaded);
    assert.equal(serializeEditorData(loaded), serializeEditorData(edited));

    // Clear pending draft
    clearPendingDraft(tenantId, templateKey, storage);
    assert.equal(loadPendingDraft(tenantId, templateKey, storage), null);
    assert.equal(storage.getItem(getPendingDraftStorageKey(tenantId, templateKey)), null);
  });

  it("saves, loads, and clears pending translation drafts", () => {
    const storage = createMockStorage();
    const tenantId = "tenant_trans_123";
    const locale = "am";

    const values = { "home.hero.title": "ሰላም", "home.hero.subtitle": "እንኳን ደህና መጡ" };
    const reviewedPaths = ["home.hero.title"];

    // Initially empty
    assert.equal(loadPendingTranslations(tenantId, locale, storage), null);

    // Save
    savePendingTranslations(tenantId, locale, values, reviewedPaths, storage);

    // Load
    const loaded = loadPendingTranslations(tenantId, locale, storage);
    assert.ok(loaded);
    assert.deepEqual(loaded.values, values);
    assert.deepEqual(loaded.reviewedPaths, reviewedPaths);

    // Clear
    clearPendingTranslations(tenantId, locale, storage);
    assert.equal(loadPendingTranslations(tenantId, locale, storage), null);
  });
});
