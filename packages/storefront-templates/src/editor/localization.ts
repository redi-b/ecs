import { getStorefrontEditorManifest } from "./registry";
import type { StorefrontEditorField, StorefrontEditorFieldKind } from "./schema";

export type StorefrontTemplateTranslationDefault = {
  source: string;
  value: string;
};

const amharicDefaults: Record<string, Record<string, StorefrontTemplateTranslationDefault>> = {
  "luvia@1": {
    "header.navigation.0.label": { source: "Home", value: "ዋና ገጽ" },
    "header.navigation.1.label": { source: "Shop", value: "ምርቶች" },
    "header.navigation.2.label": { source: "Request Item", value: "ምርት ይጠይቁ" },
    "header.navigation.3.label": { source: "Contact", value: "ያግኙን" },
    "footer.quickLinks.0.label": { source: "Home", value: "ዋና ገጽ" },
    "footer.quickLinks.1.label": { source: "Shop", value: "ምርቶች" },
    "footer.quickLinks.2.label": { source: "Contact", value: "ያግኙን" },
    "footer.quickLinks.3.label": { source: "Wishlist", value: "የተቀመጡ ምርቶች" },
    "footer.shopLinks.0.label": { source: "All products", value: "ሁሉም ምርቶች" },
    "footer.shopLinks.1.label": { source: "Request an item", value: "ምርት ይጠይቁ" },
    "footer.shopLinks.2.label": { source: "Wishlist", value: "የተቀመጡ ምርቶች" },
    "home.featuredProducts.title": { source: "Our Top-Picks", value: "ተመራጭ ምርቶች" },
    "home.story.ctaLabel": { source: "All Collections", value: "ሁሉም ስብስቦች" },
    "home.products.title": { source: "Products Listing", value: "የምርቶች ዝርዝር" },
    "home.cta.primary.label": { source: "Shop Now", value: "አሁኑኑ ይግዙ" },
    "home.cta.secondary.label": { source: "Contact Us", value: "ያግኙን" },
    "footer.inquiry.title": {
      source: "Do you have any inquiries for us?",
      value: "የሚጠይቁት ጥያቄ አለዎት?",
    },
    "footer.inquiry.ctaLabel": { source: "Let’s Get in Touch", value: "ያግኙን" },
  },
  "nexahub@1": {
    "header.navigation.0.label": { source: "Home", value: "ዋና ገጽ" },
    "header.navigation.1.label": { source: "Products", value: "ምርቶች" },
    "header.navigation.2.label": { source: "About", value: "ስለ እኛ" },
    "header.navigation.3.label": { source: "Contact", value: "ያግኙን" },
    "footer.quickLinks.0.label": { source: "Home", value: "ዋና ገጽ" },
    "footer.quickLinks.1.label": { source: "Products", value: "ምርቶች" },
    "footer.quickLinks.2.label": { source: "About", value: "ስለ እኛ" },
    "footer.quickLinks.3.label": { source: "Contact", value: "ያግኙን" },
    "home.hero.primaryCtaLabel": { source: "Our Products", value: "ምርቶቻችን" },
    "home.featuredItem.eyebrow": { source: "FEATURED PRODUCTS", value: "ተለይተው የቀረቡ ምርቶች" },
    "home.categories.eyebrow": { source: "PRODUCTS CATALOGUE", value: "የምርቶች ካታሎግ" },
    "home.contact.eyebrow": { source: "Contact Us", value: "ያግኙን" },
    "home.contact.title": {
      source: "Any Questions? Let's Get in Touch!",
      value: "ጥያቄ አለዎት? ያግኙን!",
    },
    "home.contact.ctaLabel": { source: "Send Message", value: "መልዕክት ይላኩ" },
    "listing.eyebrow": { source: "Our catalog", value: "የምርቶች ካታሎግ" },
    "listing.title": { source: "Products", value: "ምርቶች" },
  },
  "afro@1": {
    "header.navigation.0.label": { source: "Home", value: "ዋና ገጽ" },
    "header.navigation.1.label": { source: "Shop", value: "ምርቶች" },
    "header.navigation.2.label": { source: "Categories", value: "ምድቦች" },
    "header.navigation.3.label": { source: "Collections", value: "ስብስቦች" },
    "footer.quickLinks.0.label": { source: "All Products", value: "ሁሉም ምርቶች" },
    "footer.quickLinks.1.label": { source: "Jackets & Coats", value: "ጃኬቶች እና ኮቶች" },
    "footer.quickLinks.2.label": { source: "Trousers & Denim", value: "ሱሪዎች እና ጂንስ" },
    "footer.quickLinks.3.label": { source: "T-Shirts & Tops", value: "ቲሸርቶች እና ሸሚዞች" },
    "footer.quickLinks.4.label": { source: "Accessories", value: "መለዋወጫዎች" },
    "home.hero.title": {
      source: "Style That Feels Good Today and Lasts for Seasons.",
      value: "ዛሬም የሚመች፣ ለብዙ ጊዜ የሚቆይ ውብ አለባበስ።",
    },
    "home.categories.title": {
      source: "Find your own style with confidence.",
      value: "በራስ መተማመን የራስዎን ዘይቤ ያግኙ።",
    },
    "home.products.title": {
      source: "Your go-to clothing for every day.",
      value: "ለዕለት ተዕለት ኑሮዎ ተስማሚ አልባሳት።",
    },
    "home.collections.title": {
      source: "Everything you need to dress well, feel well, and look well.",
      value: "ጥሩ ለመልበስ፣ ጥሩ ስሜት እንዲሰማዎትና ውብ ሆነው ለመታየት የሚያስፈልጉዎ ነገሮች።",
    },
    "home.contact.title": {
      source: "Have a question or looking for something specific?",
      value: "ጥያቄ አለዎት ወይም የተለየ ነገር ይፈልጋሉ?",
    },
    "home.contact.infoTitle": {
      source: "Let’s keep in touch!",
      value: "እንደተገናኘን እንቆይ!",
    },
    "listing.title": { source: "All Collections", value: "ሁሉም ስብስቦች" },
  },
};

export function getStorefrontTemplateTranslationDefaults(templateKey: string, locale: "am") {
  return locale === "am" ? (amharicDefaults[templateKey] ?? {}) : {};
}

export type StorefrontEditorLocalization = "localized" | "shared";

export type StorefrontLocalizationField = StorefrontEditorField & {
  aliases: string[];
  id: string;
  localization: StorefrontEditorLocalization;
  sectionId: string;
  sectionLabel: string;
};

const localizedKinds = new Set<StorefrontEditorFieldKind>(["text", "textarea", "links"]);

export function getStorefrontLocalizationManifest(templateKey: string) {
  const manifest = getStorefrontEditorManifest(templateKey);
  if (!manifest) return undefined;

  return {
    templateKey: manifest.templateKey,
    templateVersion: manifest.templateVersion,
    fields: manifest.sections.flatMap((section) =>
      section.fields.map<StorefrontLocalizationField>((field) => ({
        ...field,
        aliases: (field.deprecatedPaths ?? []).map((path) => stableFieldId(section.id, path)),
        id: stableFieldId(section.id, field.path),
        localization:
          localizedKinds.has(field.kind) && !field.path.startsWith("themeTokens.")
            ? "localized"
            : "shared",
        sectionId: section.id,
        sectionLabel: section.label,
      })),
    ),
  };
}

export function stableFieldId(sectionId: string, path: string) {
  return `${sectionId}:${path}`;
}
