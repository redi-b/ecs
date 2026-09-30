import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DemoProductImage } from "./types.js";

/**
 * Curated local studio photography for all storefront templates.
 * All images are checked directly into the repository and served locally.
 */

const NEXAHUB_PRODUCT_LOCAL_IMAGES: Record<string, readonly string[]> = {
  "demo-tech-galaxy-a35": ["galaxy-a35-front.webp", "galaxy-a35-back.webp", "galaxy-a35-iceblue.webp"],
  "demo-tech-iphone-13": ["iphone-13-midnight.webp", "iphone-13-starlight.webp"],
  "demo-tech-redmi-note-13": ["redmi-note-13-front.webp", "redmi-note-13-back.webp"],
  "demo-tech-thinkpad-e14": ["thinkpad-e14-open.webp", "thinkpad-e14-closed.webp"],
  "demo-tech-mba-m1": ["mba-m1-spacegrey.webp", "mba-m1-silver.webp"],
  "demo-tech-earbuds-pro": ["earbuds-pro-black.webp", "earbuds-pro-macro.webp", "earbuds-pro-white.webp"],
  "demo-tech-studio-headphones": ["studio-headphones-black.webp", "studio-headphones-navy.webp"],
  "demo-tech-gan-charger": ["gan-charger.webp"],
  "demo-tech-usb-c-hub": ["usbc-hub-spacegrey.webp", "usbc-hub-ports.webp"],
  "demo-tech-laptop-sleeve": ["laptop-sleeve-graphite.webp"],
  "demo-tech-bt-speaker": ["bt-speaker-charcoal.webp", "bt-speaker-sage.webp"],
  "demo-tech-powerbank-20k": ["powerbank-20k-front.webp", "powerbank-20k-ports.webp"],
  "demo-tech-pro-max-titanium": ["titanium-phone-front.webp", "titanium-phone-back.webp"],
};

const LUVIA_PRODUCT_LOCAL_IMAGES: Record<string, readonly string[]> = {
  "demo-fashion-hyaluronic-serum": ["hyaluronic-serum.webp", "hyaluronic-serum-dropper.webp"],
  "demo-fashion-bakuchiol-oil": ["bakuchiol-oil.webp", "bakuchiol-oil-swatch.webp"],
  "demo-fashion-eye-elixir": ["eye-elixir.webp", "eye-elixir-applicator.webp"],
  "demo-fashion-camellia-cleanser": ["camellia-cleanser.webp", "camellia-cleanser-angle.webp"],
  "demo-fashion-rosemary-mist": ["rosemary-mist.webp"],
  "demo-fashion-ceramide-cream": ["ceramide-cream.webp", "ceramide-cream-open.webp"],
  "demo-fashion-peptide-mask": ["peptide-mask.webp", "peptide-mask-swatch.webp"],
  "demo-fashion-barrier-balm": ["barrier-balm.webp"],
  "demo-fashion-serum-foundation": [
    "serum-foundation-fair.webp",
    "serum-foundation-medium.webp",
    "serum-foundation-swatch.webp",
  ],
  "demo-fashion-satin-lipstick": [
    "satin-lipstick-nude.webp",
    "satin-lipstick-crimson.webp",
    "satin-lipstick-dahlia.webp",
  ],
  "demo-fashion-liquid-highlighter": ["liquid-highlighter.webp", "liquid-highlighter-wand.webp"],
  "demo-fashion-neroli-fragrance": ["neroli-perfume.webp", "neroli-perfume-angle.webp"],
  "demo-fashion-jasmine-body-oil": ["jasmine-body-oil.webp"],
  "demo-fashion-shea-body-butter": ["shea-body-butter.webp", "shea-body-butter-open.webp"],
  "demo-fashion-curation-box": ["radiance-gift-set-open.webp", "radiance-gift-set-closed.webp"],
};

const AFRO_PRODUCT_LOCAL_IMAGES: Record<string, readonly string[]> = {
  "demo-afro-suede-zip-jacket": ["product-1.png", "suede-jacket-back.png", "suede-jacket-zipper-macro.png"],
  "demo-afro-relaxed-wool-trousers": ["product-3.png", "wool-trousers-waistband.png"],
  "demo-afro-straight-leg-denim-jeans": ["product-4.png", "selvedge-denim-cuff.png"],
  "demo-afro-oxford-cotton-shirt": ["product-5.png", "oxford-shirt-folded.png"],
  "demo-afro-utilitarian-overshirt": ["product-2.png", "overshirt-open-layered.png"],
  "demo-afro-camp-collar-linen-shirt": ["product-6.png", "linen-shirt-terracotta.png"],
  "demo-afro-down-quilted-puffer": ["product-7.png", "puffer-jacket-back.png"],
  "demo-afro-club-graphic-t-shirt": ["product-8.png", "graphic-tee-back.png"],
  "demo-afro-sst-tracksuit": ["product-9.png", "sst-tracksuit-stripe-detail.png"],
  "demo-afro-sherpa-corduroy-jacket": ["product-10.png", "sherpa-jacket-open.png"],
  "demo-afro-tailored-pleat-trousers": ["tailored-pleat-trousers-charcoal.webp", "tailored-trousers-waistband.webp"],
  "demo-afro-structured-knit-cardigan": ["chunky-knit-cardigan-oatmeal.webp", "knit-cardigan-button-macro.webp"],
  "demo-afro-heavyweight-boxy-tee": ["heavyweight-tee-black.webp", "heavyweight-tee-sage.webp"],
  "demo-afro-leather-crossbody-pouch": ["leather-crossbody-pouch-black.webp", "crossbody-pouch-angle.webp"],
  "demo-afro-cotton-minimalist-beanie": ["fisherman-beanie-charcoal.webp"],
  "demo-afro-essential-everyday-tote": ["waxed-canvas-tote-olive.webp"],
};

const NEXAHUB_ASSET_DIR_CANDIDATES = [
  resolve(process.cwd(), "apps/storefront/src/templates/nexahub/v1/assets/products"),
  resolve(process.cwd(), "apps/storefront/src/templates/nexahub/v1/assets"),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/nexahub/v1/assets/products", import.meta.url),
  ),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/nexahub/v1/assets", import.meta.url),
  ),
];

const LUVIA_ASSET_DIR_CANDIDATES = [
  resolve(process.cwd(), "apps/storefront/src/templates/luvia/v1/assets/products"),
  resolve(process.cwd(), "apps/storefront/src/templates/luvia/v1/assets/categories"),
  resolve(process.cwd(), "apps/storefront/src/templates/luvia/v1/assets"),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/luvia/v1/assets/products", import.meta.url),
  ),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/luvia/v1/assets/categories", import.meta.url),
  ),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/luvia/v1/assets", import.meta.url),
  ),
];

const AFRO_ASSET_DIR_CANDIDATES = [
  resolve(process.cwd(), "apps/storefront/src/templates/afro/v1/assets"),
  resolve(process.cwd(), "apps/storefront/src/templates/afro/v1/assets/products"),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/afro/v1/assets", import.meta.url),
  ),
];

function findAssetPath(filename: string, candidates: readonly string[]): string | null {
  for (const dir of candidates) {
    const fullPath = resolve(dir, filename);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function demoProductImages(productHandle: string): readonly DemoProductImage[] {
  const nexahubFiles = NEXAHUB_PRODUCT_LOCAL_IMAGES[productHandle];
  if (nexahubFiles && nexahubFiles.length > 0) {
    const resolved = nexahubFiles
      .map((filename) => {
        const filePath = findAssetPath(filename, NEXAHUB_ASSET_DIR_CANDIDATES);
        if (!filePath) return null;
        return {
          sourceUrl: `local://nexahub/v1/assets/products/${filename}`,
          url: `file://${filePath}`,
        };
      })
      .filter((img): img is DemoProductImage => img !== null);
    if (resolved.length > 0) return resolved;
  }

  const luviaFiles = LUVIA_PRODUCT_LOCAL_IMAGES[productHandle];
  if (luviaFiles && luviaFiles.length > 0) {
    const resolved = luviaFiles
      .map((filename) => {
        const filePath = findAssetPath(filename, LUVIA_ASSET_DIR_CANDIDATES);
        if (!filePath) return null;
        return {
          sourceUrl: `local://luvia/v1/assets/products/${filename}`,
          url: `file://${filePath}`,
        };
      })
      .filter((img): img is DemoProductImage => img !== null);
    if (resolved.length > 0) return resolved;
  }

  const afroFiles = AFRO_PRODUCT_LOCAL_IMAGES[productHandle];
  if (afroFiles && afroFiles.length > 0) {
    const resolved = afroFiles
      .map((filename) => {
        const filePath = findAssetPath(filename, AFRO_ASSET_DIR_CANDIDATES);
        if (!filePath) return null;
        return {
          sourceUrl: `local://afro/v1/assets/${filename}`,
          url: `file://${filePath}`,
        };
      })
      .filter((img): img is DemoProductImage => img !== null);
    if (resolved.length > 0) return resolved;
  }

  return [];
}

export function demoTaxonomyImage(filename: string, templateKey: string): DemoProductImage | null {
  const candidates = templateKey.startsWith("nexahub")
    ? NEXAHUB_ASSET_DIR_CANDIDATES
    : templateKey.startsWith("luvia") || templateKey.startsWith("bolestyle")
      ? LUVIA_ASSET_DIR_CANDIDATES
      : AFRO_ASSET_DIR_CANDIDATES;
  const filePath = findAssetPath(filename, candidates);
  if (!filePath) return null;
  return {
    sourceUrl: `local://${templateKey}/assets/${filename}`,
    url: `file://${filePath}`,
  };
}
