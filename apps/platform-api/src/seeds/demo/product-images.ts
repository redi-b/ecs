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
  "demo-fashion-linen-midi": [985635, 1755428],
  "demo-fashion-wrap-blouse": [994523, 1462637],
  "demo-fashion-chino": [1598507, 2983464],
  "demo-fashion-crew-tee": [996329, 8532616],
  "demo-fashion-crossbody": [1152077, 1936848],
  "demo-fashion-canvas-tote": [904350, 2905238],
  "demo-fashion-sneakers": [2529148, 1598505],
  "demo-fashion-ankle-boots": [267242, 1464625],
  "demo-fashion-silk-scarf": [45982, 45055],
  "demo-fashion-blazer": [4964992, 19380820],
  "demo-fashion-denim-jacket": [1082529, 7679720],
  "demo-fashion-gift-box": [264985, 1666065],
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

function getAfroAssetPath(filename: string): string | null {
  for (const dir of AFRO_ASSET_DIR_CANDIDATES) {
    const fullPath = resolve(dir, filename);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function demoProductImages(productHandle: string): readonly DemoProductImage[] {
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
