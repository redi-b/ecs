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
      {
        canPause: true,
        canPublish: false,
        draftUsesDifferentTemplate: false,
        hasPendingChanges: false,
        mode: "live-current",
      },
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
      {
        canPause: true,
        canPublish: true,
        draftUsesDifferentTemplate: false,
        hasPendingChanges: true,
        mode: "live-with-draft",
      },
    );
  });

  it("keeps pause available while a different draft design awaits publication", () => {
    assert.deepEqual(
      getStorefrontPublicationState({
        draftTemplateKey: "editorial@1",
        hasUnpublishedChanges: false,
        isPublished: true,
        publishedTemplateKey: "luvia@1",
      }),
      {
        canPause: true,
        canPublish: true,
        draftUsesDifferentTemplate: true,
        hasPendingChanges: true,
        mode: "live-with-draft",
      },
    );
  });

  it("offers publish but never pause when the shop is offline", () => {
    assert.deepEqual(
      getStorefrontPublicationState({
        draftTemplateKey: "luvia@1",
        hasUnpublishedChanges: false,
        isPublished: false,
        publishedTemplateKey: null,
      }),
      {
        canPause: false,
        canPublish: true,
        draftUsesDifferentTemplate: false,
        hasPendingChanges: false,
        mode: "paused",
      },
    );
  });

  it("selects exactly one matching card and only offers a saved draft when one exists", () => {
    assert.equal(isStorefrontTemplateSelected("luvia@1", "luvia@1"), true);
    assert.equal(isStorefrontTemplateSelected("luvia@1", "alternate@1"), false);
    assert.equal(hasSavedStorefrontDraft(["luvia@1"], "luvia@1"), true);
    assert.equal(hasSavedStorefrontDraft(["luvia@1"], "alternate@1"), false);
  });
});
