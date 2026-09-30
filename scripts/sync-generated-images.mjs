#!/usr/bin/env node
/**
 * Maps generated AI images (01.jpg/png ... 85.jpg/png) to their permanent
 * repo destinations across Nexahub, Luvia, and AFRO templates, compressing
 * them directly into web-optimized .webp images via Sharp.
 *
 * Includes:
 *   - Prompts 01-26: Nexahub (Tech) Products
 *   - Prompts 27-55: Luvia (Clean Beauty & Cosmetics) Products
 *   - Prompts 56-65: AFRO (Contemporary Streetwear) Unique Products
 *   - Prompts 66-73: Nexahub Categories & Collections
 *   - Prompts 74-81: Luvia Categories & Collections
 *   - Prompts 82-85: AFRO Collections
 *
 * Usage:
 *   node scripts/sync-generated-images.mjs /path/to/folder-with-01-to-85
 *   node scripts/sync-generated-images.mjs /path/to/folder --delete-source
 */
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { error, heading, info, success, warn } from "./lib/cli.mjs";

const require = createRequire(resolve(process.cwd(), "apps/platform-api/package.json"));
const sharp = require("sharp");

export const IMAGE_MAPPINGS = [
  // ── Nexahub (Tech) Products (#01 – #26) ──
  {
    num: 1,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/galaxy-a35-front.webp",
    description: "A35 5G Smartphone - Front Hero",
  },
  {
    num: 2,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/galaxy-a35-back.webp",
    description: "A35 5G Smartphone - Rear Triple Camera",
  },
  {
    num: 3,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/galaxy-a35-iceblue.webp",
    description: "A35 5G Smartphone - Iceblue Variant",
  },
  {
    num: 4,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/iphone-13-midnight.webp",
    description: "Refurbished 6.1\" Smartphone - Midnight",
  },
  {
    num: 5,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/iphone-13-starlight.webp",
    description: "Refurbished 6.1\" Smartphone - Starlight",
  },
  {
    num: 6,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/redmi-note-13-front.webp",
    description: "Note 13 Android Phone - Front",
  },
  {
    num: 7,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/redmi-note-13-back.webp",
    description: "Note 13 Android Phone - Back",
  },
  {
    num: 8,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/thinkpad-e14-open.webp",
    description: "E14 14\" Business Laptop - Open",
  },
  {
    num: 9,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/thinkpad-e14-closed.webp",
    description: "E14 14\" Business Laptop - Closed",
  },
  {
    num: 10,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/mba-m1-spacegrey.webp",
    description: "M1 13\" Ultralight Laptop - Space Grey",
  },
  {
    num: 11,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/mba-m1-silver.webp",
    description: "M1 13\" Ultralight Laptop - Silver",
  },
  {
    num: 12,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/earbuds-pro-black.webp",
    description: "Wireless Earbuds Pro - Matte Black",
  },
  {
    num: 13,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/earbuds-pro-macro.webp",
    description: "Wireless Earbuds Pro - Macro Detail",
  },
  {
    num: 14,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/earbuds-pro-white.webp",
    description: "Wireless Earbuds Pro - Glacier White",
  },
  {
    num: 15,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/studio-headphones-black.webp",
    description: "Over-Ear Studio Headphones - Black",
  },
  {
    num: 16,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/studio-headphones-navy.webp",
    description: "Over-Ear Studio Headphones - Navy",
  },
  {
    num: 17,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/gan-charger.webp",
    description: "65W GaN Charger - Single View",
  },
  {
    num: 18,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/usbc-hub-spacegrey.webp",
    description: "USB-C Hub 7-in-1 - Space Grey",
  },
  {
    num: 19,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/usbc-hub-ports.webp",
    description: "USB-C Hub 7-in-1 - Ports Angle",
  },
  {
    num: 20,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/laptop-sleeve-graphite.webp",
    description: "Laptop Sleeve 14\" - Single View",
  },
  {
    num: 21,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/bt-speaker-charcoal.webp",
    description: "Bluetooth Speaker Mini - Charcoal",
  },
  {
    num: 22,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/bt-speaker-sage.webp",
    description: "Bluetooth Speaker Mini - Sage",
  },
  {
    num: 23,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/powerbank-20k-front.webp",
    description: "Power Bank 20000mAh - Front LED",
  },
  {
    num: 24,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/powerbank-20k-ports.webp",
    description: "Power Bank 20000mAh - Ports Angle",
  },
  {
    num: 25,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/titanium-phone-front.webp",
    description: "Pro Max Titanium Smartphone - Front",
  },
  {
    num: 26,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/products/titanium-phone-back.webp",
    description: "Pro Max Titanium Smartphone - Back",
  },

  // ── Luvia (Clean Beauty & Cosmetics) Products (#27 – #55) ──
  {
    num: 27,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/hyaluronic-serum.webp",
    description: "Aura Hyaluronic Hydration Serum - Base Bottle",
  },
  {
    num: 28,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/hyaluronic-serum-dropper.webp",
    description: "Aura Hyaluronic Hydration Serum - Pipette Dropper Angle",
  },
  {
    num: 29,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/bakuchiol-oil.webp",
    description: "Botanical Bakuchiol Radiance Oil - Base Bottle",
  },
  {
    num: 30,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/bakuchiol-oil-swatch.webp",
    description: "Botanical Bakuchiol Radiance Oil - Texture Swatch",
  },
  {
    num: 31,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/eye-elixir.webp",
    description: "Vitamin C Brightening Eye Elixir - Base Tube",
  },
  {
    num: 32,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/eye-elixir-applicator.webp",
    description: "Vitamin C Brightening Eye Elixir - Cooling Tip Macro",
  },
  {
    num: 33,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/camellia-cleanser.webp",
    description: "Oat & Camellia Purifying Gel Cleanser - Base Bottle",
  },
  {
    num: 34,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/camellia-cleanser-angle.webp",
    description: "Oat & Camellia Purifying Gel Cleanser - 45° Angle",
  },
  {
    num: 35,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/rosemary-mist.webp",
    description: "Balancing Rosemary & Rose Hydrosol Mist - Single Hero View",
  },
  {
    num: 36,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/ceramide-cream.webp",
    description: "Ceramide Barrier Moisture Cream - Base Jar",
  },
  {
    num: 37,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/ceramide-cream-open.webp",
    description: "Ceramide Barrier Moisture Cream - Open Jar & Whipped Swatch",
  },
  {
    num: 38,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/peptide-mask.webp",
    description: "Overnight Restorative Peptide Mask - Base Jar",
  },
  {
    num: 39,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/peptide-mask-swatch.webp",
    description: "Overnight Restorative Peptide Mask - Open Jar with Swatch",
  },
  {
    num: 40,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/barrier-balm.webp",
    description: "Multi-Active Restoring Barrier Balm - Single Hero View",
  },
  {
    num: 41,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/serum-foundation-fair.webp",
    description: "Luminous Silk Serum Foundation - Fair Neutral",
  },
  {
    num: 42,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/serum-foundation-medium.webp",
    description: "Luminous Silk Serum Foundation - Medium Warm",
  },
  {
    num: 43,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/serum-foundation-swatch.webp",
    description: "Luminous Silk Serum Foundation - Texture Swatch",
  },
  {
    num: 44,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/satin-lipstick-nude.webp",
    description: "Velvet Matte Satin Lipstick - Bare Nude",
  },
  {
    num: 45,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/satin-lipstick-crimson.webp",
    description: "Velvet Matte Satin Lipstick - Crimson Velvet (Sold Out Test)",
  },
  {
    num: 46,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/satin-lipstick-dahlia.webp",
    description: "Velvet Matte Satin Lipstick - Dusty Dahlia",
  },
  {
    num: 47,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/liquid-highlighter.webp",
    description: "Dewy Liquid Sculpt & Glow Highlighter - Base Bottle",
  },
  {
    num: 48,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/liquid-highlighter-wand.webp",
    description: "Dewy Liquid Sculpt & Glow Highlighter - Cushion Wand Swatch",
  },
  {
    num: 49,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/neroli-perfume.webp",
    description: "Solar Neroli & Cedarwood Eau de Parfum - Base Bottle",
  },
  {
    num: 50,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/neroli-perfume-angle.webp",
    description: "Solar Neroli & Cedarwood Eau de Parfum - Cap Off Angle",
  },
  {
    num: 51,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/jasmine-body-oil.webp",
    description: "Wild Jasmine Nourishing Body Oil - Single Hero View",
  },
  {
    num: 52,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/shea-body-butter.webp",
    description: "Whipped Shea & Sea Kelp Body Butter - Base Jar",
  },
  {
    num: 53,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/shea-body-butter-open.webp",
    description: "Whipped Shea & Sea Kelp Body Butter - Open Swatch",
  },
  {
    num: 54,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/radiance-gift-set-open.webp",
    description: "The Radiance Essentials 4-Piece Curation - Open Box",
  },
  {
    num: 55,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/products/radiance-gift-set-closed.webp",
    description: "The Radiance Essentials 4-Piece Curation - Closed Box",
  },

  // ── AFRO (Contemporary Streetwear) Unique Products (#56 – #65) ──
  {
    num: 56,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/tailored-pleat-trousers-charcoal.webp",
    description: "Tailored Double-Pleat Wide Trousers - Charcoal Hero",
  },
  {
    num: 57,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/tailored-trousers-waistband.webp",
    description: "Tailored Double-Pleat Wide Trousers - Waistband Detail",
  },
  {
    num: 58,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/chunky-knit-cardigan-oatmeal.webp",
    description: "Chunky Ribbed Wool Cardigan - Oatmeal Hero",
  },
  {
    num: 59,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/knit-cardigan-button-macro.webp",
    description: "Chunky Ribbed Wool Cardigan - Horn Buttons Macro",
  },
  {
    num: 60,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/heavyweight-tee-black.webp",
    description: "Ultra-Heavyweight 300GSM Boxy Tee - Washed Black Hero",
  },
  {
    num: 61,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/heavyweight-tee-sage.webp",
    description: "Ultra-Heavyweight 300GSM Boxy Tee - Vintage Sage",
  },
  {
    num: 62,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/leather-crossbody-pouch-black.webp",
    description: "Pebbled Leather Crossbody Utility Pouch - Front Hero",
  },
  {
    num: 63,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/crossbody-pouch-angle.webp",
    description: "Pebbled Leather Crossbody Utility Pouch - Angle & Hardware",
  },
  {
    num: 64,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/fisherman-beanie-charcoal.webp",
    description: "Ribbed Fisherman Wool Beanie - Single Hero View",
  },
  {
    num: 65,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/waxed-canvas-tote-olive.webp",
    description: "Waxed Canvas Everyday Utility Tote - Single Hero View",
  },

  // ── Nexahub (Tech) Categories & Collections (#66 – #73) ──
  {
    num: 66,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/category-phones.webp",
    description: "Nexahub Category Banner - Phones",
  },
  {
    num: 67,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/category-laptops.webp",
    description: "Nexahub Category Banner - Laptops & Computing",
  },
  {
    num: 68,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/category-audio.webp",
    description: "Nexahub Category Banner - Audio & Sound",
  },
  {
    num: 69,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/category-accessories.webp",
    description: "Nexahub Category Banner - Workspace Accessories",
  },
  {
    num: 70,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/collection-best-sellers.webp",
    description: "Nexahub Collection Banner - Best Sellers",
  },
  {
    num: 71,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/collection-new-arrivals.webp",
    description: "Nexahub Collection Banner - New Arrivals",
  },
  {
    num: 72,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/collection-wfh.webp",
    description: "Nexahub Collection Banner - Work From Home",
  },
  {
    num: 73,
    template: "nexahub",
    dest: "apps/storefront/src/templates/nexahub/v1/assets/collection-deals.webp",
    description: "Nexahub Collection Banner - Clearance & Deals",
  },

  // ── Luvia (Clean Beauty) Categories & Collections (#74 – #81) ──
  {
    num: 74,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/category-skincare.webp",
    description: "Luvia Category Banner - Skincare",
  },
  {
    num: 75,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/category-makeup.webp",
    description: "Luvia Category Banner - Makeup & Complexion",
  },
  {
    num: 76,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/category-fragrance.webp",
    description: "Luvia Category Banner - Fragrance & Scents",
  },
  {
    num: 77,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/category-body.webp",
    description: "Luvia Category Banner - Body & Bath",
  },
  {
    num: 78,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/collection-best-sellers.webp",
    description: "Luvia Collection Banner - Best Sellers",
  },
  {
    num: 79,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/collection-daily-rituals.webp",
    description: "Luvia Collection Banner - Daily Rituals",
  },
  {
    num: 80,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/collection-gift-sets.webp",
    description: "Luvia Collection Banner - Gift Sets & Curations",
  },
  {
    num: 81,
    template: "luvia",
    dest: "apps/storefront/src/templates/luvia/v1/assets/categories/collection-special-offers.webp",
    description: "Luvia Collection Banner - Special Offers",
  },

  // ── AFRO (Contemporary Apparel) Collections (#82 – #85) ──
  {
    num: 82,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/collection-women.webp",
    description: "AFRO Collection Banner - Women's Collection",
  },
  {
    num: 83,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/collection-men.webp",
    description: "AFRO Collection Banner - Men's Collection",
  },
  {
    num: 84,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/collection-new-season.webp",
    description: "AFRO Collection Banner - New Season Arrivals",
  },
  {
    num: 85,
    template: "afro",
    dest: "apps/storefront/src/templates/afro/v1/assets/collection-archival-sale.webp",
    description: "AFRO Collection Banner - Archival Sale",
  },
];

const deleteSource = process.argv.includes("--delete-source");
const sourceDir = process.argv[2] && !process.argv[2].startsWith("--") ? resolve(process.argv[2]) : null;

if (!sourceDir) {
  error("Please specify folder containing generated images (01.jpg/png ... 85.jpg/png).");
  console.log(`
Usage:
  node scripts/sync-generated-images.mjs /path/to/folder [--delete-source]
  `);
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  error(`Directory not found: ${sourceDir}`);
  process.exit(1);
}

heading(`Ingesting & Compressing Images from: ${sourceDir}`);
let processed = 0;
let missing = 0;
let totalOriginalBytes = 0;
let totalCompressedBytes = 0;

for (const item of IMAGE_MAPPINGS) {
  const numPad = String(item.num).padStart(2, "0");
  const candidateExtensions = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"];
  
  const candidateNames = [
    ...candidateExtensions.map((ext) => `${numPad}.${ext}`),
    ...candidateExtensions.map((ext) => `${item.num}.${ext}`),
    ...candidateExtensions.map((ext) => `PROMPT_${numPad}.${ext}`),
    ...candidateExtensions.map((ext) => `PROMPT_${item.num}.${ext}`),
  ];

  const matched = candidateNames
    .map((name) => resolve(sourceDir, name))
    .find((filePath) => existsSync(filePath));

  const destPath = resolve(process.cwd(), item.dest);
  mkdirSync(dirname(destPath), { recursive: true });

  if (matched) {
    const origSize = statSync(matched).size;
    totalOriginalBytes += origSize;

    // Convert and compress to WebP (quality 85, max dimension 1600px)
    await sharp(matched)
      .rotate() // auto-orient based on EXIF
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 85,
        effort: 5,
      })
      .toFile(destPath);

    const compressedSize = statSync(destPath).size;
    totalCompressedBytes += compressedSize;

    const ratio = Math.round((compressedSize / origSize) * 100);
    info(
      `[#${numPad}] ${item.description}\n       → ${item.dest} (${Math.round(origSize / 1024)}KB → ${Math.round(compressedSize / 1024)}KB, ${ratio}%)`,
    );
    processed += 1;
  } else {
    warn(`[#${numPad}] Not found in folder (searched: ${numPad}.jpg/png, ${item.num}.jpg/png)`);
    missing += 1;
  }
}

const origMB = (totalOriginalBytes / (1024 * 1024)).toFixed(2);
const compMB = (totalCompressedBytes / (1024 * 1024)).toFixed(2);

success(
  `\nCompleted: ${processed} images processed & compressed into WebP (${origMB} MB → ${compMB} MB), ${missing} missing.`,
);

if (deleteSource && processed > 0 && missing === 0) {
  rmSync(sourceDir, { recursive: true, force: true });
  info(`Cleaned up source directory: ${sourceDir}`);
}
