import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDraftPayload,
  buildEditorData,
  getPublicationStatus,
  isPreviewImageUrl,
  serializeEditorData,
  updateEditorLinkValue,
} from "./editor-state.js";
import type { EditorData } from "./editor-state.js";

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

    const editorData = buildEditorData(draft);

    assert.equal(editorData.content[0]?.props?.heroTitle, "Original title");
    assert.equal(editorData.content[0]?.props?.primaryColor, "#0f766e");

    const editedData: EditorData = {
      ...editorData,
      content: editorData.content.map((item) =>
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
      templateKey: draft.templateKey,
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

  it("uses the selected template manifest for Luvia fields", () => {
    const draft = {
      data: {
        header: { navigation: [] },
        home: {
          hero: {
            enabled: true,
            title: "Luvia hero",
            subtitle: "Description",
            primaryCtaLabel: "Shop",
            primaryCtaHref: "/products",
            featuredProductId: "prod_legacy",
            featuredProductIds: [],
            trustLabels: ["One", "Two", "Three"],
          },
          featuredProducts: { enabled: true, title: "Top picks", productIds: [], limit: 8 },
          featuredCollection: { enabled: false, title: "", limit: 12 },
          products: { enabled: true, title: "Products", productIds: [], limit: 12 },
        },
        footer: { blurb: "Original footer", socialLinks: [] },
      },
      templateKey: "luvia@1",
      templateVersion: 1,
      tenantId: "tenant_luvia",
      themeTokens: { colors: { primary: "#3ee272" } },
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
    const editorData = buildEditorData(draft);
    assert.equal(editorData.content[0]?.props?.heroTitle, "Luvia hero");
    assert.equal(editorData.content[0]?.props?.footerBlurb, "Original footer");
    assert.deepEqual(editorData.content[0]?.props?.headerNavigation, []);
    assert.deepEqual(editorData.content[0]?.props?.footerSocialLinks, []);

    const editedData: EditorData = {
      ...editorData,
      content: editorData.content.map((item) => ({
        ...item,
        props: {
          ...item.props,
          heroTitle: "Edited Luvia hero",
          heroFeaturedProductIds: ["prod_one", "prod_two"],
          footerBlurb: "Edited footer",
          headerNavigation: [{ label: "Shop", href: "/products" }],
          footerSocialLinks: [
            { label: "Instagram", href: "https://instagram.com/example" },
            { label: "", href: "/incomplete" },
          ],
        },
      })),
    };
    const payload = buildDraftPayload({
      data: draft.data,
      editorData: editedData,
      templateKey: draft.templateKey,
      tenantId: draft.tenantId,
      themeTokens: draft.themeTokens,
    });
    const data = payload.data as {
      header: { navigation: Array<{ label: string; href: string }> };
      home: { hero: { title: string; featuredProductId?: string; featuredProductIds: string[] } };
      footer: { blurb: string; socialLinks: Array<{ label: string; href: string }> };
    };
    assert.equal(data.home.hero.title, "Edited Luvia hero");
    assert.deepEqual(data.home.hero.featuredProductIds, ["prod_one", "prod_two"]);
    assert.equal(data.home.hero.featuredProductId, undefined);
    assert.equal(data.footer.blurb, "Edited footer");
    assert.deepEqual(data.header.navigation, [{ label: "Shop", href: "/products" }]);
    assert.deepEqual(data.footer.socialLinks, [
      { label: "Instagram", href: "https://instagram.com/example" },
    ]);
  });

  it("classifies published, saved draft, and unsaved editor states", () => {
    const savedData = {
      content: [
        {
          props: { heroTitle: "Saved", id: "storefront-page" },
          type: "StorefrontPage",
        },
      ],
      root: {},
    } satisfies EditorData;
    const editedData = {
      content: [
        {
          props: { heroTitle: "Edited", id: "storefront-page" },
          type: "StorefrontPage",
        },
      ],
      root: {},
    } satisfies EditorData;

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

  it("updates an exact navigation row edited from the iframe", () => {
    const links = [{ label: "Home", href: "/" }, { label: "Shop", href: "/products" }];
    assert.deepEqual(
      updateEditorLinkValue(links, "header.navigation", "header.navigation.1.label", "Catalog"),
      [{ label: "Home", href: "/" }, { label: "Catalog", href: "/products" }],
    );
    assert.equal(updateEditorLinkValue(links, "header.navigation", "footer.socialLinks.0.label", "No"), null);
  });
});
