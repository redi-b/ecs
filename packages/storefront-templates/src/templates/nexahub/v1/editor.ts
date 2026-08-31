import type { StorefrontEditorManifest } from "../../../editor/schema";

export const nexahubV1EditorSchema = {
  templateKey: "nexahub@1",
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
        { path: "header.logoAssetId", prop: "nexahubLogoAssetId", label: "Logo", kind: "image" },
        { path: "header.navigation", prop: "nexahubHeaderNavigation", label: "Navigation links", kind: "links", preview: { strategy: "preserve-structure" } },
      ],
    },
    {
      id: "hero",
      label: "Hero",
      fields: [
        { path: "home.hero.enabled", prop: "nexahubHeroEnabled", label: "Show section", kind: "boolean" },
        { path: "home.hero.eyebrow", prop: "nexahubHeroEyebrow", label: "Eyebrow", kind: "text" },
        { path: "home.hero.title", prop: "nexahubHeroTitle", label: "Headline", kind: "text" },
        { path: "home.hero.body", prop: "nexahubHeroBody", label: "Description", kind: "textarea" },
        { path: "home.hero.imageAssetId", prop: "nexahubHeroImage", label: "Hero image", kind: "image" },
        { path: "home.hero.primaryCtaLabel", prop: "nexahubHeroCtaLabel", label: "Button label", kind: "text" },
        { path: "home.hero.primaryCtaHref", prop: "nexahubHeroCtaHref", label: "Button link", kind: "link" },
      ],
    },
    {
      id: "featured-item",
      label: "Featured item",
      fields: [
        { path: "home.featuredItem.enabled", prop: "nexahubFeaturedEnabled", label: "Show section", kind: "boolean" },
        { path: "home.featuredItem.eyebrow", prop: "nexahubFeaturedEyebrow", label: "Eyebrow", kind: "text" },
        { path: "home.featuredItem.title", prop: "nexahubFeaturedTitle", label: "Title", kind: "text" },
        { path: "home.featuredItem.body", prop: "nexahubFeaturedBody", label: "Description", kind: "textarea" },
        { path: "home.featuredItem.productIds", prop: "nexahubFeaturedProducts", label: "Products", kind: "products", maxItems: 5, helpText: "Choose and order up to five carousel products, or leave empty to use the newest available products." },
        { path: "home.featuredItem.imageAssetId", prop: "nexahubFeaturedImage", label: "Editorial image", kind: "image" },
      ],
    },
    {
      id: "categories",
      label: "Categories",
      fields: [
        { path: "home.categories.enabled", prop: "nexahubCategoriesEnabled", label: "Show section", kind: "boolean" },
        { path: "home.categories.eyebrow", prop: "nexahubCategoriesEyebrow", label: "Eyebrow", kind: "text" },
        { path: "home.categories.title", prop: "nexahubCategoriesTitle", label: "Title", kind: "text" },
        { path: "home.categories.collectionIds", prop: "nexahubCategoryCollections", label: "Collections", kind: "collections", maxItems: 6, helpText: "Choose up to six collections, or leave empty to use the current catalog collections. Collection imagery is managed in Products > Collections.", preview: { strategy: "variant-options", variants: ["featured", "standard"] } },
      ],
    },
    {
      id: "selected-products",
      label: "Selected products",
      fields: [
        { path: "home.bestSellers.enabled", prop: "nexahubProductsEnabled", label: "Show section", kind: "boolean" },
        { path: "home.bestSellers.title", prop: "nexahubProductsTitle", label: "Section title", kind: "text" },
        { path: "home.bestSellers.productIds", prop: "nexahubProductIds", label: "Products", kind: "products", maxItems: 24, helpText: "Choose and order products, or leave empty to show the newest available products." },
      ],
    },
    {
      id: "quality",
      label: "Quality statement",
      fields: [
        { path: "home.quality.enabled", prop: "nexahubQualityEnabled", label: "Show section", kind: "boolean" },
        { path: "home.quality.eyebrow", prop: "nexahubQualityEyebrow", label: "Eyebrow", kind: "text" },
        { path: "home.quality.title", prop: "nexahubQualityTitle", label: "Title", kind: "text" },
        { path: "home.quality.body", prop: "nexahubQualityBody", label: "Description", kind: "textarea" },
        { path: "home.quality.imageAssetId", prop: "nexahubQualityImage", label: "Image", kind: "image" },
      ],
    },
    {
      id: "contact",
      label: "Contact callout",
      fields: [
        { path: "home.contact.enabled", prop: "nexahubContactEnabled", label: "Show section", kind: "boolean" },
        { path: "home.contact.eyebrow", prop: "nexahubContactEyebrow", label: "Eyebrow", kind: "text" },
        { path: "home.contact.title", prop: "nexahubContactTitle", label: "Title", kind: "text" },
        { path: "home.contact.body", prop: "nexahubContactBody", label: "Description", kind: "textarea" },
        { path: "home.contact.imageAssetId", prop: "nexahubContactImage", label: "Image", kind: "image" },
        { path: "home.contact.ctaLabel", prop: "nexahubContactCtaLabel", label: "Button label", kind: "text" },
        { path: "home.contact.ctaHref", prop: "nexahubContactCtaHref", label: "Button link", kind: "link" },
      ],
    },
    {
      id: "listing",
      label: "Product listing",
      previewPage: "products",
      fields: [
        { path: "listing.eyebrow", prop: "nexahubListingEyebrow", label: "Eyebrow", kind: "text" },
        { path: "listing.title", prop: "nexahubListingTitle", label: "Title", kind: "text" },
        { path: "listing.body", prop: "nexahubListingBody", label: "Description", kind: "textarea" },
      ],
    },
    {
      id: "footer",
      label: "Footer",
      fields: [
        { path: "footer.blurb", prop: "nexahubFooterBlurb", label: "Description", kind: "textarea" },
        { path: "footer.quickLinks", prop: "nexahubFooterLinks", label: "Quick links", kind: "links", preview: { strategy: "list-items" } },
        { path: "footer.socialLinks", prop: "nexahubSocialLinks", label: "Social links", kind: "links", preview: { strategy: "preserve-structure" } },
        { path: "footer.phone", prop: "nexahubFooterPhone", label: "Phone", kind: "text" },
        { path: "footer.email", prop: "nexahubFooterEmail", label: "Email", kind: "text" },
        { path: "footer.address", prop: "nexahubFooterAddress", label: "Address", kind: "textarea" },
      ],
    },
    {
      id: "footer-credit",
      label: "Design credit",
      fields: [
        { path: "footer.credit.enabled", prop: "nexahubCreditEnabled", label: "Show design credit", kind: "boolean", helpText: "Show the fixed ECS design credit in the storefront footer." },
      ],
    },
    {
      id: "theme",
      label: "Appearance",
      fields: [
        { path: "themeTokens.colors.primary", prop: "primaryColor", label: "Brand color", kind: "color", helpText: "Supporting colors are generated to preserve this template's contrast and visual character." },
      ],
    },
  ],
} satisfies StorefrontEditorManifest;
