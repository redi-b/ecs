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

export function demoProductImages(productHandle: string): readonly DemoProductImage[] {
  return (DEMO_PRODUCT_PHOTO_IDS[productHandle] ?? []).map((photoId) => ({
    sourceUrl: `https://www.pexels.com/photo/${photoId}/`,
    url:
      `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg` +
      "?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=1200",
  }));
}
