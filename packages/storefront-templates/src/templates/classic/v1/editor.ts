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
          path: "announcement.enabled",
          prop: "announcementEnabled",
          label: "Show on storefront",
          kind: "boolean",
        },
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
          path: "home.hero.enabled",
          prop: "heroEnabled",
          label: "Show on storefront",
          kind: "boolean",
        },
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
      id: "featured-collection",
      label: "Featured collection",
      fields: [
        {
          path: "home.featuredCollection.enabled",
          prop: "featuredCollectionEnabled",
          label: "Show on storefront",
          kind: "boolean",
        },
        {
          path: "home.featuredCollection.title",
          prop: "featuredCollectionTitle",
          label: "Section title",
          kind: "text",
          helpText: "Optional. Leave blank to use the collection name.",
        },
        {
          path: "home.featuredCollection.collectionId",
          prop: "featuredCollectionId",
          label: "Collection",
          kind: "collection",
        },
      ],
    },
    {
      id: "featured-products",
      label: "Featured products",
      fields: [
        {
          path: "home.featuredProducts.enabled",
          prop: "featuredProductsEnabled",
          label: "Show on storefront",
          kind: "boolean",
        },
        {
          path: "home.featuredProducts.title",
          prop: "productSectionTitle",
          label: "Section title",
          kind: "text",
        },
        {
          path: "home.featuredProducts.productIds",
          prop: "featuredProductIds",
          label: "Products",
          kind: "products",
        },
      ],
    },
    {
      id: "collections-strip",
      label: "Collections strip",
      fields: [
        {
          path: "home.collectionsStrip.enabled",
          prop: "collectionsStripEnabled",
          label: "Show on storefront",
          kind: "boolean",
        },
        {
          path: "home.collectionsStrip.title",
          prop: "collectionsStripTitle",
          label: "Section title",
          kind: "text",
        },
      ],
    },
    {
      id: "trust",
      label: "Trust row",
      fields: [
        {
          path: "home.trust.enabled",
          prop: "trustEnabled",
          label: "Show on storefront",
          kind: "boolean",
        },
      ],
    },
    {
      id: "testimonials",
      label: "Testimonials",
      fields: [
        {
          path: "home.testimonials.enabled",
          prop: "testimonialsEnabled",
          label: "Show on storefront",
          kind: "boolean",
        },
        {
          path: "home.testimonials.title",
          prop: "testimonialsTitle",
          label: "Section title",
          kind: "text",
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
          path: "themeTokens.surfaceMode",
          prop: "surfaceMode",
          label: "Surface",
          kind: "text",
          helpText: "Light or dark base. Brand color fills the rest of the palette.",
        },
        {
          path: "themeTokens.colors.primary",
          prop: "primaryColor",
          label: "Brand color",
          kind: "color",
          helpText: "We generate background, text, muted, and accent for contrast.",
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
