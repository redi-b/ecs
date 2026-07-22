import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Data } from "@puckeditor/core";

import {
  buildDraftPayload,
  buildPuckData,
  getPublicationStatus,
  isPreviewImageUrl,
  serializeEditorData,
} from "./editor-state.js";

describe("storefront editor state", () => {
  it("builds editable page data from the draft and writes edits back to the draft payload", () => {
    const draft = {
      data: {
        announcement: { text: "Opening soon" },
        header: {
          logoAssetId: "asset_logo",
          navigation: [{ href: "/products", label: "Shop" }],
        },
        home: {
          hero: {
            imageAssetId: "asset_hero",
            primaryCtaHref: "/products",
            primaryCtaLabel: "Shop now",
            subtitle: "Fresh stock daily",
            title: "Original title",
          },
          featuredProducts: { title: "Featured" },
        },
        footer: { address: "1 Main St", phone: "555-0100" },
      },
      templateKey: "classic@1",
      templateVersion: 1,
      tenantId: "tenant_1",
      themeTokens: {
        colors: {
          background: "#f8fafc",
          foreground: "#111827",
          muted: "#64748b",
          primary: "#0f766e",
        },
        typography: { bodyFont: "Geist", headingFont: "Manrope" },
      },
      updatedAt: "2026-07-07T00:00:00.000Z",
    };

    const puckData = buildPuckData(draft);

    assert.equal(puckData.content[0]?.props?.heroTitle, "Original title");
    assert.equal(puckData.content[0]?.props?.primaryColor, "#0f766e");

    const editedData: Data = {
      ...puckData,
      content: puckData.content.map((item) =>
        item.type === "StorefrontPage"
          ? {
              ...item,
              props: {
                ...item.props,
                heroTitle: "Updated title",
                heroImageAssetId: "",
                primaryColor: "#f97316",
              },
            }
          : item,
      ),
    };

    const payload = buildDraftPayload({
      data: draft.data,
      editorData: editedData,
      tenantId: draft.tenantId,
      themeTokens: draft.themeTokens,
    });

    assert.equal(payload.tenantId, "tenant_1");
    const data = payload.data as {
      home: { hero: { title?: string; imageAssetId?: string } };
    };
    const themeTokens = payload.themeTokens as { colors: { primary?: string } };
    assert.equal(data.home.hero.title, "Updated title");
    assert.equal(data.home.hero.imageAssetId, undefined);
    assert.equal(themeTokens.colors.primary, "#f97316");
  });

  it("classifies published, saved draft, and unsaved editor states", () => {
    const savedData = {
      content: [
        {
          props: { heroTitle: "Saved" },
          type: "StorefrontPage",
        },
      ],
      root: {},
    } satisfies Data;
    const editedData = {
      content: [
        {
          props: { heroTitle: "Edited" },
          type: "StorefrontPage",
        },
      ],
      root: {},
    } satisfies Data;

    const savedSnapshot = serializeEditorData(savedData);
    const editedSnapshot = serializeEditorData(editedData);

    assert.equal(
      getPublicationStatus({
        currentSnapshot: savedSnapshot,
        publishedSnapshot: savedSnapshot,
        savedSnapshot,
      }),
      "published",
    );
    assert.equal(
      getPublicationStatus({
        currentSnapshot: savedSnapshot,
        publishedSnapshot: null,
        savedSnapshot,
      }),
      "saved-draft",
    );
    assert.equal(
      getPublicationStatus({
        currentSnapshot: editedSnapshot,
        publishedSnapshot: savedSnapshot,
        savedSnapshot,
      }),
      "unsaved",
    );
  });

  it("identifies image references that can be rendered directly in the preview", () => {
    assert.equal(isPreviewImageUrl("https://example.com/hero.jpg"), true);
    assert.equal(isPreviewImageUrl("http://example.com/logo.png"), true);
    assert.equal(isPreviewImageUrl("data:image/png;base64,abc123"), true);
    assert.equal(isPreviewImageUrl("asset_hero"), false);
    assert.equal(isPreviewImageUrl("/relative-image.jpg"), false);
    assert.equal(isPreviewImageUrl(""), false);
  });
});
