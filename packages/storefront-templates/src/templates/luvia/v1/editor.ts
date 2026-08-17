import type { StorefrontEditorManifest } from "../../../editor/schema";

export const luviaV1EditorSchema = {
  templateKey: "luvia@1",
  templateVersion: 1,
  previewMode: "iframe",
  theme: {
    allowSurfaceMode: false,
    editableColors: ["primary", "foreground", "muted", "accent"],
    paletteStrategy: "tonal",
  },
  sections: [
    {
      id: "header",
      label: "Header",
      fields: [
        { path: "header.logoAssetId", prop: "logoAssetId", label: "Logo", kind: "image" },
        { path: "header.navigation", prop: "headerNavigation", label: "Navigation links", kind: "links", helpText: "Choose the labels and destinations shown in the storefront header." },
      ],
    },
    {
      id: "hero",
      label: "Hero",
      fields: [
        { path: "home.hero.enabled", prop: "heroEnabled", label: "Show section", kind: "boolean" },
        { path: "home.hero.title", prop: "heroTitle", label: "Headline", kind: "text" },
        { path: "home.hero.subtitle", prop: "heroSubtitle", label: "Description", kind: "textarea" },
        { path: "home.hero.imageAssetId", prop: "heroImageAssetId", label: "Background", kind: "image" },
        { path: "home.hero.portraitAssetId", prop: "heroPortraitAssetId", label: "Portrait", kind: "image" },
        { path: "home.hero.featuredProductIds", prop: "heroFeaturedProductIds", label: "Featured product carousel", kind: "products", deprecatedPaths: ["home.hero.featuredProductId"], helpText: "Choose up to six products. An empty selection uses the newest catalog products." },
        { path: "home.hero.primaryCtaLabel", prop: "heroCtaLabel", label: "Button label", kind: "text" },
        { path: "home.hero.primaryCtaHref", prop: "heroCtaHref", label: "Button link", kind: "link" },
        { path: "home.hero.trustLabels.0", prop: "heroTrustLabelOne", label: "First trust label", kind: "text" },
        { path: "home.hero.trustLabels.1", prop: "heroTrustLabelTwo", label: "Second trust label", kind: "text" },
        { path: "home.hero.trustLabels.2", prop: "heroTrustLabelThree", label: "Third trust label", kind: "text" },
      ],
    },
    {
      id: "top-picks",
      label: "Top picks",
      fields: [
        { path: "home.featuredProducts.enabled", prop: "topPicksEnabled", label: "Show section", kind: "boolean" },
        { path: "home.featuredProducts.title", prop: "topPicksTitle", label: "Section title", kind: "text" },
        { path: "home.featuredProducts.productIds", prop: "topPickIds", label: "Products", kind: "products" },
      ],
    },
    {
      id: "story",
      label: "Brand story",
      fields: [
        { path: "home.story.enabled", prop: "storyEnabled", label: "Show section", kind: "boolean" },
        { path: "home.story.body", prop: "storyBody", label: "Description", kind: "textarea" },
        { path: "home.story.titleFirstLine", prop: "storyTitleFirstLine", label: "First title line", kind: "text" },
        { path: "home.story.titleSecondLine", prop: "storyTitleSecondLine", label: "Second title line", kind: "text" },
        { path: "home.story.ctaLabel", prop: "storyCtaLabel", label: "Button label", kind: "text" },
        { path: "home.story.ctaHref", prop: "storyCtaHref", label: "Button link", kind: "link" },
      ],
    },
    {
      id: "brand-statement",
      label: "Brand statement",
      fields: [
        { path: "home.brandStatement.enabled", prop: "brandStatementEnabled", label: "Show section", kind: "boolean" },
        { path: "home.brandStatement.firstLine", prop: "brandStatementFirstLine", label: "First line", kind: "text" },
        { path: "home.brandStatement.middleLine", prop: "brandStatementMiddleLine", label: "Middle line", kind: "text" },
        { path: "home.brandStatement.lastLine", prop: "brandStatementLastLine", label: "Last line", kind: "text" },
        { path: "home.brandStatement.imageAssetId", prop: "brandStatementImageAssetId", label: "Product image", kind: "image" },
      ],
    },
    {
      id: "expertise",
      label: "Expertise",
      fields: [
        { path: "home.expertise.enabled", prop: "expertiseEnabled", label: "Show section", kind: "boolean" },
        { path: "home.expertise.title", prop: "expertiseTitle", label: "Title", kind: "text" },
        { path: "home.expertise.body", prop: "expertiseBody", label: "Description", kind: "textarea" },
        { path: "home.expertise.quote", prop: "expertiseQuote", label: "Statement", kind: "textarea" },
        { path: "home.expertise.imageAssetId", prop: "expertiseImageAssetId", label: "Laboratory image", kind: "image" },
        { path: "home.expertise.ctaLabel", prop: "expertiseCtaLabel", label: "Button label", kind: "text" },
        { path: "home.expertise.ctaHref", prop: "expertiseCtaHref", label: "Button link", kind: "link" },
      ],
    },
    {
      id: "categories",
      label: "Categories",
      fields: [
        { path: "home.categories.enabled", prop: "categoriesEnabled", label: "Show section", kind: "boolean" },
        { path: "home.categories.title", prop: "categoriesTitle", label: "Title", kind: "text" },
        { path: "home.categories.collectionIds", prop: "categoryCollectionIds", label: "Collections", kind: "collections", helpText: "Choose and order the real catalog collections customers can explore here." },
        { path: "home.categories.imageAssetId", prop: "categoriesImageAssetId", label: "Feature image", kind: "image" },
        { path: "home.categories.previewAssetId", prop: "categoriesPreviewAssetId", label: "Product preview image", kind: "image" },
      ],
    },
    {
      id: "call-to-action",
      label: "Call to action",
      fields: [
        { path: "home.cta.enabled", prop: "ctaEnabled", label: "Show section", kind: "boolean" },
        { path: "home.cta.title", prop: "ctaTitle", label: "Title", kind: "text" },
        { path: "home.cta.imageAssetId", prop: "ctaImageAssetId", label: "Background image", kind: "image" },
        { path: "home.cta.primary.enabled", prop: "ctaPrimaryEnabled", label: "Show primary button", kind: "boolean" },
        { path: "home.cta.primary.label", prop: "ctaPrimaryLabel", label: "Primary button label", kind: "text" },
        { path: "home.cta.primary.href", prop: "ctaPrimaryHref", label: "Primary button link", kind: "link" },
        { path: "home.cta.secondary.enabled", prop: "ctaSecondaryEnabled", label: "Show secondary button", kind: "boolean" },
        { path: "home.cta.secondary.label", prop: "ctaSecondaryLabel", label: "Secondary button label", kind: "text" },
        { path: "home.cta.secondary.href", prop: "ctaSecondaryHref", label: "Secondary button link", kind: "link" },
      ],
    },
    {
      id: "product-listing",
      label: "Product listing",
      fields: [
        { path: "home.products.enabled", prop: "productsEnabled", label: "Show section", kind: "boolean" },
        { path: "home.products.title", prop: "productsTitle", label: "Section title", kind: "text" },
        { path: "home.products.productIds", prop: "productIds", label: "Products", kind: "products" },
      ],
    },
    {
      id: "featured-collection",
      label: "Featured collection",
      fields: [
        { path: "home.featuredCollection.enabled", prop: "featuredCollectionEnabled", label: "Show collection", kind: "boolean" },
        { path: "home.featuredCollection.collectionId", prop: "featuredCollectionId", label: "Collection", kind: "collection" },
      ],
    },
    {
      id: "footer",
      label: "Footer",
      fields: [
        { path: "footer.blurb", prop: "footerBlurb", label: "Description", kind: "textarea" },
        { path: "footer.quickLinks", prop: "footerQuickLinks", label: "Quick links", kind: "links" },
        { path: "footer.shopLinks", prop: "footerShopLinks", label: "Shop links", kind: "links" },
        { path: "footer.socialLinks", prop: "footerSocialLinks", label: "Social links", kind: "links", helpText: "Add only the social profiles you want customers to see." },
        { path: "footer.phone", prop: "footerPhone", label: "Phone", kind: "text" },
        { path: "footer.email", prop: "footerEmail", label: "Email", kind: "text" },
        { path: "footer.address", prop: "footerAddress", label: "Address", kind: "textarea" },
        { path: "footer.inquiry.title", prop: "footerInquiryTitle", label: "Inquiry banner title", kind: "text" },
        { path: "footer.inquiry.ctaLabel", prop: "footerInquiryCtaLabel", label: "Inquiry button label", kind: "text" },
        { path: "footer.inquiry.ctaHref", prop: "footerInquiryCtaHref", label: "Inquiry button link", kind: "link" },
      ],
    },
    {
      id: "footer-credit",
      label: "Design credit",
      fields: [
        { path: "footer.credit.enabled", prop: "footerCreditEnabled", label: "Show design credit", kind: "boolean", helpText: "Show the fixed ECS design credit in the storefront footer." },
      ],
    },
    {
      id: "theme",
      label: "Appearance",
      fields: [
        { path: "themeTokens.colors.primary", prop: "primaryColor", label: "Brand color", kind: "color" },
        { path: "themeTokens.colors.background", prop: "backgroundColor", label: "Background color", kind: "color" },
        { path: "themeTokens.colors.foreground", prop: "foregroundColor", label: "Text color", kind: "color" },
        { path: "themeTokens.colors.muted", prop: "mutedColor", label: "Soft surface", kind: "color" },
        { path: "themeTokens.colors.accent", prop: "accentColor", label: "Accent color", kind: "color" },
        { path: "themeTokens.typography.headingFont", prop: "headingFont", label: "Heading font", kind: "text" },
        { path: "themeTokens.typography.bodyFont", prop: "bodyFont", label: "Body font", kind: "text" },
      ],
    },
  ],
} satisfies StorefrontEditorManifest;
