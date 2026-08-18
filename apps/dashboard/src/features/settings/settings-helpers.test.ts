import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getStorefrontPublicationState,
  hasSavedStorefrontDraft,
  isStorefrontTemplateSelected,
} from "./settings-helpers";

describe("storefront settings state", () => {
  it("returns to the live pause state when the selected design matches the published storefront", () => {
    assert.deepEqual(
      getStorefrontPublicationState({
        draftTemplateKey: "luvia@1",
        hasUnpublishedChanges: false,
        isPublished: true,
        publishedTemplateKey: "luvia@1",
      }),
      { canPause: true, canPublish: false, hasPendingChanges: false },
    );
  });

  it("keeps publish available when content changed within the published design", () => {
    assert.deepEqual(
      getStorefrontPublicationState({
        draftTemplateKey: "luvia@1",
        hasUnpublishedChanges: true,
        isPublished: true,
        publishedTemplateKey: "luvia@1",
      }),
      { canPause: false, canPublish: true, hasPendingChanges: true },
    );
  });

  it("selects exactly one matching card and only offers a saved draft when one exists", () => {
    assert.equal(isStorefrontTemplateSelected("luvia@1", "luvia@1"), true);
    assert.equal(isStorefrontTemplateSelected("luvia@1", "alternate@1"), false);
    assert.equal(hasSavedStorefrontDraft(["luvia@1"], "luvia@1"), true);
    assert.equal(hasSavedStorefrontDraft(["luvia@1"], "alternate@1"), false);
  });
});
