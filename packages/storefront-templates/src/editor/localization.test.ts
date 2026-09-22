import assert from "node:assert/strict";
import test from "node:test";
import {
  getStorefrontLocalizationManifest,
  getStorefrontTemplateTranslationDefaults,
} from "./localization";
import { storefrontEditorManifests } from "./registry";

test("every editor field has a stable unique id and explicit localization classification", () => {
  for (const templateKey of Object.keys(storefrontEditorManifests)) {
    const manifest = getStorefrontLocalizationManifest(templateKey);
    assert.ok(manifest);
    assert.equal(new Set(manifest.fields.map((field) => field.id)).size, manifest.fields.length);
    assert.ok(
      manifest.fields.every(
        (field) => field.localization === "localized" || field.localization === "shared",
      ),
    );
    assert.ok(
      manifest.fields
        .filter((field) => field.kind === "image")
        .every((field) => field.localization === "shared"),
    );
    assert.ok(
      manifest.fields
        .filter((field) => field.kind === "color")
        .every((field) => field.localization === "shared"),
    );
  }
});

test("deprecated paths become stable migration aliases", () => {
  const manifest = getStorefrontLocalizationManifest("luvia@1");
  const carousel = manifest?.fields.find((field) => field.path === "home.hero.featuredProductIds");
  assert.deepEqual(carousel?.aliases, ["hero:home.hero.featuredProductId"]);
});

test("appearance settings remain shared rather than becoming translatable copy", () => {
  const manifest = getStorefrontLocalizationManifest("luvia@1");
  const appearance = manifest?.fields.filter((field) => field.path.startsWith("themeTokens."));
  assert.ok(appearance?.length);
  assert.ok(appearance.every((field) => field.localization === "shared"));
});

test("provides conservative Amharic defaults for stock template labels", () => {
  const nexaDefaults = getStorefrontTemplateTranslationDefaults("nexahub@1", "am");
  assert.deepEqual(nexaDefaults["header.navigation.0.label"], {
    source: "Home",
    value: "ዋና ገጽ",
  });
  assert.deepEqual(nexaDefaults["home.contact.title"], {
    source: "Any Questions? Let's Get in Touch!",
    value: "ጥያቄ አለዎት? ያግኙን!",
  });

  const luviaDefaults = getStorefrontTemplateTranslationDefaults("luvia@1", "am");
  assert.deepEqual(luviaDefaults["header.navigation.0.label"], {
    source: "Home",
    value: "ዋና ገጽ",
  });
  assert.deepEqual(luviaDefaults["footer.quickLinks.3.label"], {
    source: "Wishlist",
    value: "የተቀመጡ ምርቶች",
  });
  assert.deepEqual(luviaDefaults["footer.inquiry.title"], {
    source: "Do you have any inquiries for us?",
    value: "የሚጠይቁት ጥያቄ አለዎት?",
  });
  assert.deepEqual(luviaDefaults["home.cta.primary.label"], {
    source: "Shop Now",
    value: "አሁኑኑ ይግዙ",
  });

  assert.deepEqual(getStorefrontTemplateTranslationDefaults("unknown@1", "am"), {});
});
