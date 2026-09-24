import type { StorefrontEditorManifest } from "../../../editor/schema";

export const afroV1EditorSchema = {
  templateKey: "afro@1",
  templateVersion: 1,
  previewMode: "iframe",
  previewPages: [
    { id: "home", label: "Home" },
    { id: "products", label: "Products" },
  ],
  theme: {
    allowSurfaceMode: false,
    editableColors: ["primary"],
    paletteStrategy: "tonal",
  },
  sections: [
    {
      id: "header",
      label: "Header",
      fields: [
        { path: "header.logoAssetId", prop: "afroLogoAssetId", label: "Logo", kind: "image" },
        {
          path: "header.promoText",
          prop: "afroPromoText",
          label: "Promo banner text",
          kind: "text",
        },
        {
          path: "header.countdownText",
          prop: "afroCountdownText",
          label: "Countdown timer",
          kind: "text",
        },
        {
          path: "header.navigation",
          prop: "afroHeaderNavigation",
          label: "Navigation links",
          kind: "links",
          preview: { strategy: "preserve-structure" },
        },
      ],
    },
    {
      id: "hero",
      label: "Hero",
      fields: [
        {
          path: "home.hero.enabled",
          prop: "afroHeroEnabled",
          label: "Show section",
          kind: "boolean",
        },
        { path: "home.hero.title", prop: "afroHeroTitle", label: "Headline", kind: "text" },
        {
          path: "home.hero.imageAssetId",
          prop: "afroHeroImage",
          label: "Hero image",
          kind: "image",
        },
        {
          path: "home.hero.productIds",
          prop: "afroHeroProducts",
          label: "Carousel products",
          kind: "products",
          maxItems: 6,
          helpText:
            "Choose up to 6 products for the hero carousel, or leave empty to use newest products.",
        },
      ],
    },
    {
      id: "categories",
      label: "Categories",
      fields: [
        {
          path: "home.categories.enabled",
          prop: "afroCategoriesEnabled",
          label: "Show section",
          kind: "boolean",
        },
        {
          path: "home.categories.title",
          prop: "afroCategoriesTitle",
          label: "Title",
          kind: "text",
        },
        {
          path: "home.categories.collectionIds",
          prop: "afroCategoryCollections",
          label: "Categories",
          kind: "collections",
          maxItems: 12,
          helpText:
            "Choose up to 12 categories, or leave empty to use current catalog categories.",
          preview: { strategy: "variant-options", variants: ["active", "standard"] },
        },
      ],
    },
    {
      id: "selected-products",
      label: "Selected products",
      fields: [
        {
          path: "home.products.enabled",
          prop: "afroProductsEnabled",
          label: "Show section",
          kind: "boolean",
        },
        {
          path: "home.products.title",
          prop: "afroProductsTitle",
          label: "Section title",
          kind: "text",
        },
        {
          path: "home.products.productIds",
          prop: "afroProductIds",
          label: "Products",
          kind: "products",
          maxItems: 24,
          helpText:
            "Choose and order products, or leave empty to show the newest available products.",
        },
      ],
    },
    {
      id: "collections",
      label: "Collections",
      fields: [
        {
          path: "home.collections.enabled",
          prop: "afroCollectionsEnabled",
          label: "Show section",
          kind: "boolean",
        },
        {
          path: "home.collections.title",
          prop: "afroCollectionsTitle",
          label: "Title",
          kind: "text",
        },
        {
          path: "home.collections.collectionIds",
          prop: "afroCollectionIds",
          label: "Collections",
          kind: "collections",
          maxItems: 8,
          helpText: "Choose collections for the collections carousel slider.",
        },
      ],
    },
    {
      id: "contact",
      label: "Contact callout",
      fields: [
        {
          path: "home.contact.enabled",
          prop: "afroContactEnabled",
          label: "Show section",
          kind: "boolean",
        },
        { path: "home.contact.title", prop: "afroContactTitle", label: "Title", kind: "text" },
        {
          path: "home.contact.infoTitle",
          prop: "afroContactInfoTitle",
          label: "Info title",
          kind: "text",
        },
        {
          path: "home.contact.infoBody",
          prop: "afroContactInfoBody",
          label: "Info description",
          kind: "textarea",
        },
      ],
    },
    {
      id: "listing",
      label: "Product listing",
      previewPage: "products",
      fields: [
        { path: "listing.title", prop: "afroListingTitle", label: "Title", kind: "text" },
        {
          path: "listing.body",
          prop: "afroListingBody",
          label: "Description",
          kind: "textarea",
        },
        {
          path: "listing.imageAssetId",
          prop: "afroListingImage",
          label: "Header image",
          kind: "image",
        },
      ],
    },
    {
      id: "footer",
      label: "Footer",
      fields: [
        {
          path: "footer.blurb",
          prop: "afroFooterBlurb",
          label: "Tagline",
          kind: "textarea",
        },
        {
          path: "footer.quickLinks",
          prop: "afroFooterLinks",
          label: "Quick links",
          kind: "links",
          preview: { strategy: "list-items" },
        },
        {
          path: "footer.socialLinks",
          prop: "afroSocialLinks",
          label: "Social links",
          kind: "links",
          preview: { strategy: "preserve-structure" },
        },
        { path: "footer.phone", prop: "afroFooterPhone", label: "Phone 1", kind: "text" },
        { path: "footer.phone2", prop: "afroFooterPhone2", label: "Phone 2", kind: "text" },
        { path: "footer.email", prop: "afroFooterEmail", label: "Email", kind: "text" },
      ],
    },
    {
      id: "footer-credit",
      label: "Design credit",
      fields: [
        {
          path: "footer.credit.enabled",
          prop: "afroCreditEnabled",
          label: "Show design credit",
          kind: "boolean",
          helpText: "Show the fixed ECS design credit in the storefront footer.",
        },
      ],
    },
    {
      id: "theme",
      label: "Appearance",
      fields: [
        {
          path: "themeTokens.colors.primary",
          prop: "primaryColor",
          label: "Brand color",
          kind: "color",
          helpText:
            "Supporting colors are generated to preserve this template's contrast and visual character.",
        },
      ],
    },
  ],
} satisfies StorefrontEditorManifest;
