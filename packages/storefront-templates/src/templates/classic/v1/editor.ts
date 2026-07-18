import type { StorefrontEditorManifest } from "../../../editor/schema";

export const classicV1EditorSchema = {
  templateKey: "classic@1",
  templateVersion: 1,
  sections: [
    {
      id: "announcement",
      label: "Announcement",
      fields: [
        {
          path: "announcement.text",
          prop: "announcementText",
          label: "Announcement text",
          kind: "text",
        },
      ],
    },
    {
      id: "header",
      label: "Header",
      fields: [
        {
          path: "header.logoAssetId",
          prop: "logoAssetId",
          label: "Logo",
          kind: "image",
        },
        {
          path: "header.navigation.0.label",
          prop: "navigationLabel",
          label: "Primary navigation label",
          kind: "text",
        },
        {
          path: "header.navigation.0.href",
          prop: "navigationHref",
          label: "Primary navigation link",
          kind: "link",
        },
      ],
    },
    {
      id: "hero",
      label: "Hero",
      fields: [
        {
          path: "home.hero.title",
          prop: "heroTitle",
          label: "Headline",
          kind: "text",
        },
        {
          path: "home.hero.subtitle",
          prop: "heroSubtitle",
          label: "Subheading",
          kind: "textarea",
        },
        {
          path: "home.hero.imageAssetId",
          prop: "heroImageAssetId",
          label: "Hero image",
          kind: "image",
        },
        {
          path: "home.hero.primaryCtaLabel",
          prop: "primaryCtaLabel",
          label: "Button label",
          kind: "text",
        },
        {
          path: "home.hero.primaryCtaHref",
          prop: "primaryCtaHref",
          label: "Button link",
          kind: "link",
        },
      ],
    },
    {
      id: "featured-products",
      label: "Featured products",
      fields: [
        {
          path: "home.featuredProducts.title",
          prop: "productSectionTitle",
          label: "Section title",
          kind: "text",
          helpText: "Product selection remains managed outside the editor.",
        },
      ],
    },
    {
      id: "footer",
      label: "Footer",
      fields: [
        {
          path: "footer.phone",
          prop: "footerPhone",
          label: "Phone",
          kind: "text",
        },
        {
          path: "footer.address",
          prop: "footerAddress",
          label: "Address",
          kind: "textarea",
        },
      ],
    },
    {
      id: "theme",
      label: "Theme",
      fields: [
        {
          path: "themeTokens.colors.background",
          prop: "backgroundColor",
          label: "Background color",
          kind: "color",
        },
        {
          path: "themeTokens.colors.foreground",
          prop: "foregroundColor",
          label: "Text color",
          kind: "color",
        },
        {
          path: "themeTokens.colors.primary",
          prop: "primaryColor",
          label: "Primary color",
          kind: "color",
        },
        {
          path: "themeTokens.colors.muted",
          prop: "mutedColor",
          label: "Muted color",
          kind: "color",
        },
        {
          path: "themeTokens.colors.accent",
          prop: "accentColor",
          label: "Accent color",
          kind: "color",
        },
        {
          path: "themeTokens.typography.headingFont",
          prop: "headingFont",
          label: "Heading font",
          kind: "text",
        },
        {
          path: "themeTokens.typography.bodyFont",
          prop: "bodyFont",
          label: "Body font",
          kind: "text",
        },
      ],
    },
  ],
} satisfies StorefrontEditorManifest;
