import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DemoProductImage } from "./types.js";

/**
 * Curated, product-matched photography for the public showcase.
 *
 * This is a checked-in manifest instead of a search/random-photo API. Re-seeds
 * therefore produce the same catalog, and every source can be audited or
 * replaced independently. Pexels permits commercial use without attribution;
 * source pages are still retained in product metadata as a maintenance trail.
 */
const DEMO_PRODUCT_PHOTO_IDS: Record<string, readonly number[]> = {
  "demo-tech-galaxy-a35": [404280, 607812],
  "demo-tech-iphone-13": [699122, 1092644],
  "demo-tech-redmi-note-13": [47261, 1092644],
  "demo-tech-thinkpad-e14": [24790756, 4073705],
  "demo-tech-mba-m1": [4073705, 7888648],
  "demo-tech-earbuds-pro": [30608591, 3394650],
  "demo-tech-studio-headphones": [3394666, 1649771],
  "demo-tech-gan-charger": [3921696, 4526407],
  "demo-tech-usb-c-hub": [4219861, 3921696],
  "demo-tech-laptop-sleeve": [89723, 4065891],
  "demo-tech-bt-speaker": [35436825, 13658002],
  "demo-tech-powerbank-20k": [3921704, 5208777],

  // Luvia Cosmetics & Skincare — solid studio grey backgrounds
  "demo-fashion-hydra-serum": [4041392, 3685530, 4465124],
  "demo-fashion-botanical-face-oil": [3762879, 7262991, 3373746],
  "demo-fashion-peptide-night-cream": [4041391, 4465831, 7262988],
  "demo-fashion-clarifying-cleanser": [4465829, 8128071, 4465830],
  "demo-fashion-facial-mist": [8128069, 4465125],
  "demo-fashion-mineral-clay-mask": [7263004, 7263009, 6621472],
  "demo-fashion-brightening-eye-elixir": [7262987, 8128070, 6621473],
  "demo-fashion-barrier-balm": [7263005, 6621474],
  "demo-fashion-velvet-matte-lipstick": [7428102, 7428103],
  "demo-fashion-liquid-highlighter": [7263007, 3373745],
  "demo-fashion-eau-de-parfum": [8140898, 8140899, 8140900],
  "demo-fashion-body-lotion": [8467972, 4465830],
  "demo-fashion-botanical-body-butter": [8467973, 4465831],
  "demo-fashion-signature-gift-set": [4465828, 7262988],

  // Legacy aliases
  "demo-fashion-linen-midi": [4041392, 3685530],
  "demo-fashion-wrap-blouse": [3762879, 7262991],
  "demo-fashion-chino": [4041391, 4465831],
  "demo-fashion-crew-tee": [4465829, 8128071],
  "demo-fashion-crossbody": [8140898, 8140899],
  "demo-fashion-canvas-tote": [7263004, 7263009],
  "demo-fashion-sneakers": [7428102, 7428103],
  "demo-fashion-ankle-boots": [7262987, 8128070],
  "demo-fashion-silk-scarf": [8128069, 4465125],
  "demo-fashion-blazer": [7263005, 6621474],
  "demo-fashion-denim-jacket": [8467972, 4465830],
  "demo-fashion-gift-box": [4465828, 7262988],
};

const AFRO_PRODUCT_LOCAL_IMAGES: Record<string, readonly string[]> = {
  "demo-afro-suede-zip-jacket": ["product-1.png", "men-collection.png", "bg-jackets.png"],
  "demo-afro-relaxed-wool-trousers": ["product-3.png", "product-4.png", "bg-trousers.png"],
  "demo-afro-straight-leg-denim-jeans": ["product-4.png", "product-3.png", "bg-trousers.png"],
  "demo-afro-oxford-cotton-shirt": ["product-5.png", "product-6.png", "bg-shirts.png"],
  "demo-afro-utilitarian-overshirt": ["product-2.png", "bg-shirts.png", "product-1.png"],
  "demo-afro-camp-collar-linen-shirt": ["product-6.png", "product-5.png", "bg-shirts.png"],
  "demo-afro-down-quilted-puffer": ["product-7.png", "women-collection.png", "bg-jackets.png"],
  "demo-afro-club-graphic-t-shirt": ["product-8.png", "product-5.png", "bg-shirts.png"],
  "demo-afro-sst-tracksuit": ["product-9.png", "product-8.png", "men-collection.png"],
  "demo-afro-sherpa-corduroy-jacket": ["product-10.png", "men-collection.png", "bg-jackets.png"],
  "demo-afro-tailored-pleat-trousers": ["product-3.png", "product-4.png", "bg-trousers.png"],
  "demo-afro-leather-crossbody-pouch": ["bg-accessories.png", "product-1.png"],
  "demo-afro-cotton-minimalist-beanie": ["bg-accessories.png", "product-10.png"],
  "demo-afro-essential-everyday-tote": ["bg-accessories.png", "product-7.png"],
  "demo-afro-heavyweight-boxy-tee": ["product-8.png", "product-5.png"],
  "demo-afro-structured-knit-cardigan": ["product-2.png", "product-7.png", "women-collection.png"],
  // Legacy aliases
  "demo-afro-heavyweight-box-tee": ["product-8.png", "product-5.png"],
  "demo-afro-structured-overshirt": ["product-2.png", "bg-shirts.png"],
  "demo-afro-tailored-linen-shirt": ["product-6.png", "product-5.png"],
  "demo-afro-leather-crossbody-bag": ["bg-accessories.png", "product-1.png"],
  "demo-afro-wool-blend-cardigan": ["product-7.png", "women-collection.png"],
  "demo-afro-pleated-wide-trousers": ["product-4.png", "product-3.png"],
  "demo-afro-minimalist-leather-belt": ["bg-accessories.png", "product-10.png"],
  "demo-afro-everyday-cotton-crewneck": ["product-9.png", "product-8.png"],
  "demo-afro-chelsea-leather-boots": ["product-10.png", "men-collection.png"],
  "demo-afro-merino-wool-scarf": ["bg-accessories.png", "product-7.png"],
};

const AFRO_ASSET_DIR_CANDIDATES = [
  resolve(process.cwd(), "apps/storefront/src/templates/afro/v1/assets"),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/afro/v1/assets", import.meta.url),
  ),
  resolve("/home/hossa/projects/Websites/ecom-template-3/src/assets"),
];

const LUVIA_PRODUCT_LOCAL_IMAGES: Record<string, readonly string[]> = {
  "demo-fashion-hydra-serum": ["hydra-serum.png", "hydra-serum-2.png"],
  "demo-fashion-botanical-face-oil": ["botanical-face-oil.png", "botanical-face-oil-2.png"],
  "demo-fashion-peptide-night-cream": ["peptide-night-cream.png", "peptide-night-cream-2.png"],
  "demo-fashion-clarifying-cleanser": ["clarifying-cleanser.png", "clarifying-cleanser-2.png"],
  "demo-fashion-facial-mist": ["facial-mist.png", "facial-mist-2.png"],
  "demo-fashion-mineral-clay-mask": ["mineral-clay-mask.png", "mineral-clay-mask-2.png"],
  "demo-fashion-brightening-eye-elixir": ["eye-elixir.png", "eye-elixir-2.png"],
  "demo-fashion-barrier-balm": ["barrier-balm.png", "barrier-balm-2.png"],
  "demo-fashion-velvet-matte-lipstick": ["velvet-lipstick.png", "velvet-lipstick-2.png"],
  "demo-fashion-liquid-highlighter": ["liquid-highlighter.png", "liquid-highlighter-2.png"],
  "demo-fashion-eau-de-parfum": ["eau-de-parfum.png", "eau-de-parfum-2.png"],
  "demo-fashion-body-lotion": ["body-lotion.png", "body-lotion-2.png"],
  "demo-fashion-botanical-body-butter": ["body-butter.png", "body-butter-2.png"],
  "demo-fashion-signature-gift-set": ["gift-set.png", "gift-set-2.png"],
};

const LUVIA_ASSET_DIR_CANDIDATES = [
  resolve(process.cwd(), "apps/storefront/src/templates/luvia/v1/assets/products"),
  resolve(process.cwd(), "apps/storefront/src/templates/luvia/v1/assets"),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/luvia/v1/assets/products", import.meta.url),
  ),
  fileURLToPath(
    new URL("../../../../../apps/storefront/src/templates/luvia/v1/assets", import.meta.url),
  ),
];

function getAfroAssetPath(filename: string): string | null {
  for (const dir of AFRO_ASSET_DIR_CANDIDATES) {
    const fullPath = resolve(dir, filename);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

function getLuviaAssetPath(filename: string): string | null {
  for (const dir of LUVIA_ASSET_DIR_CANDIDATES) {
    const fullPath = resolve(dir, filename);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function demoProductImages(productHandle: string): readonly DemoProductImage[] {
  const luviaLocalFiles = LUVIA_PRODUCT_LOCAL_IMAGES[productHandle];
  if (luviaLocalFiles && luviaLocalFiles.length > 0) {
    const resolved = luviaLocalFiles
      .map((filename) => {
        const filePath = getLuviaAssetPath(filename);
        if (!filePath) return null;
        return {
          sourceUrl: `local://luvia/v1/assets/${filename}`,
          url: `file://${filePath}`,
        };
      })
      .filter((img): img is DemoProductImage => img !== null);
    if (resolved.length > 0) return resolved;
  }

  const localFiles = AFRO_PRODUCT_LOCAL_IMAGES[productHandle];
  if (localFiles && localFiles.length > 0) {
    return localFiles.map((filename) => {
      const filePath = getAfroAssetPath(filename);
      return {
        sourceUrl: `local://afro/v1/assets/${filename}`,
        url: filePath
          ? `file://${filePath}`
          : `https://images.pexels.com/photos/1082529/pexels-photo-1082529.jpeg`,
      };
    });
  }

  return (DEMO_PRODUCT_PHOTO_IDS[productHandle] ?? []).map((photoId) => ({
    sourceUrl: `https://www.pexels.com/photo/${photoId}/`,
    url:
      `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg` +
      "?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=1200",
  }));
}
