/**
 * Demo seed definitions: two Ethiopian shops (tech + fashion), separate owners.
 * Stable IDs keep re-seeds idempotent.
 *
 * Handles:
 *   - addistech  (tech; no dashes — easy to type)
 *   - bolestyle   (fashion)
 */

export type DemoCustomer = {
  address: string;
  area: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type DemoCategory = {
  handle: string;
  name: string;
  /** Parent category handle within the same shop (nested taxonomy). */
  parentHandle?: string;
};

export type DemoProductOption = {
  title: string;
  values: readonly string[];
};

export type DemoProductVariant = {
  /** Option title → value, e.g. { Size: "M", Color: "Black" }. */
  options: Record<string, string>;
  price: number;
  sku: string;
  /** Absolute stocked quantity; omit for a healthy default. */
  stock?: number;
  title?: string;
};

export type DemoProduct = {
  /** Category handle for assignment (prefer leaf categories). */
  categoryHandle?: string;
  collectionHandle?: string;
  description: string;
  handle: string;
  /** Broad merchandising family retained in seeded product metadata. */
  imageCategory: string;
  options: readonly DemoProductOption[];
  title: string;
  variants: readonly DemoProductVariant[];
};

export type DemoProductImage = {
  /** Stable Pexels photo page retained for license/source auditing. */
  sourceUrl: string;
  /** CDN rendition copied into ECS media storage by the demo seed. */
  url: string;
};

export type DemoShopDefinition = {
  categories: ReadonlyArray<DemoCategory>;
  collections: ReadonlyArray<{ handle: string; title: string }>;
  customers: ReadonlyArray<DemoCustomer>;
  ids: {
    account: string;
    domain: string;
    membership: string;
    onboarding: string;
    storefrontConfig: string;
    storefrontRevision: string;
    tenant: string;
    user: string;
  };
  /** Payment onboarding stub for Settings UI (no real Chapa secrets). */
  paymentOnboarding: {
    notes: string;
    status: string;
  };
  products: ReadonlyArray<DemoProduct>;
  tenant: {
    handle: string;
    name: string;
  };
  user: {
    email: string;
    name: string;
    phone: string;
  };
};

export const DEMO_OPERATIONS = {
  approver: {
    email: "approvalsdemo@ecs.et",
    id: "d0000000-0000-4000-8000-000000000002",
    name: "ECS Access Approver",
  },
  operator: {
    email: "operationsdemo@ecs.et",
    id: "d0000000-0000-4000-8000-000000000001",
    name: "ECS Operations Demo",
  },
  principalId: "d0000000-0000-4000-8000-000000000101",
} as const;

export const DEMO_OPERATIONS_PASSWORD = process.env.SEED_OPERATIONS_PASSWORD ?? "operations1234";

/** Cartesian product of option axes → variants (prices step by index). */
function matrixProduct(
  title: string,
  handle: string,
  imageCategory: string,
  basePrice: number,
  optionAxes: readonly DemoProductOption[],
  stockPattern: readonly number[],
  description?: string,
): DemoProduct {
  const combos: Array<Record<string, string>> = [{}];
  for (const axis of optionAxes) {
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const value of axis.values) {
        next.push({ ...combo, [axis.title]: value });
      }
    }
    combos.splice(0, combos.length, ...next);
  }

  const skuBase = handle.toUpperCase().replaceAll("-", "_");
  return {
    title,
    handle,
    imageCategory,
    description: description ?? `${title}. Local delivery and cash on delivery available.`,
    options: optionAxes,
    variants: combos.map((options, index) => {
      const label = optionAxes.map((axis) => options[axis.title]).join(" / ");
      const stock = stockPattern[index % stockPattern.length] ?? 20;
      return {
        options,
        title: `${title} / ${label}`,
        sku: `${skuBase}_${index + 1}`,
        price: basePrice + index * Math.round(basePrice * 0.08),
        stock,
      };
    }),
  };
}

/** Single-axis product (storage, size, color, etc.). */
function singleAxisProduct(
  title: string,
  handle: string,
  imageCategory: string,
  basePrice: number,
  optionTitle: string,
  values: readonly string[],
  stockPattern: readonly number[] = [40, 12, 3, 0],
  description?: string,
): DemoProduct {
  return matrixProduct(
    title,
    handle,
    imageCategory,
    basePrice,
    [{ title: optionTitle, values }],
    stockPattern,
    description,
  );
}

export const DEMO_SEED_MARKER = "ecs-demo-v5";
export const DEMO_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "password1234";

/** Prior demo handles/emails still cleaned so renames do not leave orphans. */
export const LEGACY_DEMO_HANDLES = ["addis-tech", "bole-style"] as const;
export const LEGACY_DEMO_EMAILS = ["owner@addis-tech.local"] as const;

/** Tech shop — phones, laptops, accessories. Handle has no dashes. */
export const techShop: DemoShopDefinition = {
  ids: {
    tenant: "d1000000-0000-4000-8000-000000000001",
    domain: "d1000000-0000-4000-8000-000000000002",
    user: "d1000000-0000-4000-8000-000000000003",
    account: "d1000000-0000-4000-8000-000000000003:credential",
    membership: "d1000000-0000-4000-8000-000000000004",
    onboarding: "d1000000-0000-4000-8000-000000000005",
    storefrontRevision: "d1000000-0000-4000-8000-000000000006",
    storefrontConfig: "d1000000-0000-4000-8000-000000000007",
  },
  tenant: {
    handle: "addistech",
    name: "Addis Tech Hub",
  },
  user: {
    email: "yonatan@addistech.ecs.et",
    name: "Yonatan Bekele",
    phone: "+251911100001",
  },
  paymentOnboarding: {
    status: "not_configured",
    notes: "Demo shop — Chapa not connected (COD only).",
  },
  categories: [
    { name: "Phones", handle: "demo-tech-phones" },
    { name: "Android", handle: "demo-tech-phones-android", parentHandle: "demo-tech-phones" },
    { name: "Apple", handle: "demo-tech-phones-apple", parentHandle: "demo-tech-phones" },
    { name: "Laptops", handle: "demo-tech-laptops" },
    { name: "Windows", handle: "demo-tech-laptops-windows", parentHandle: "demo-tech-laptops" },
    { name: "Mac", handle: "demo-tech-laptops-mac", parentHandle: "demo-tech-laptops" },
    { name: "Audio", handle: "demo-tech-audio" },
    { name: "Accessories", handle: "demo-tech-accessories" },
  ],
  collections: [
    { title: "Best Sellers", handle: "demo-tech-best-sellers" },
    { title: "New Arrivals", handle: "demo-tech-new-arrivals" },
    { title: "Work From Home", handle: "demo-tech-wfh" },
  ],
  customers: [
    {
      firstName: "Abel",
      lastName: "Tesfaye",
      email: "abel.tesfaye.tech@example.com",
      phone: "+251911200101",
      area: "Bole",
      address: "Bole Medhanialem",
    },
    {
      firstName: "Sara",
      lastName: "Haile",
      email: "sara.haile.tech@example.com",
      phone: "+251911200102",
      area: "Kazanchis",
      address: "Kazanchis Business District",
    },
    {
      firstName: "Daniel",
      lastName: "Mekonnen",
      email: "daniel.mekonnen.tech@example.com",
      phone: "+251911200103",
      area: "CMC",
      address: "CMC Michael",
    },
    {
      firstName: "Hiwot",
      lastName: "Alemu",
      email: "hiwot.alemu.tech@example.com",
      phone: "+251911200104",
      area: "Piassa",
      address: "Arada Piassa",
    },
    {
      firstName: "Yared",
      lastName: "Girma",
      email: "yared.girma.tech@example.com",
      phone: "+251911200105",
      area: "Megenagna",
      address: "Megenagna Zefmesh",
    },
    {
      firstName: "Betty",
      lastName: "Assefa",
      email: "betty.assefa.tech@example.com",
      phone: "+251911200106",
      area: "Sarbet",
      address: "Sarbet Roundabout",
    },
    {
      firstName: "Kalkidan",
      lastName: "Wondimu",
      email: "kalkidan.wondimu.tech@example.com",
      phone: "+251911200107",
      area: "Ayat",
      address: "Ayat Square",
    },
    {
      firstName: "Mikiyas",
      lastName: "Tadesse",
      email: "mikiyas.tadesse.tech@example.com",
      phone: "+251911200108",
      area: "Mexico",
      address: "Mexico Square",
    },
    {
      firstName: "Eyerusalem",
      lastName: "Kassa",
      email: "eyerusalem.kassa.tech@example.com",
      phone: "+251911200109",
      area: "Gerji",
      address: "Gerji Mebrat Hail",
    },
  ],
  products: [
    {
      ...singleAxisProduct(
        "A35 5G Smartphone",
        "demo-tech-galaxy-a35",
        "phones",
        28900,
        "Storage",
        ["128GB", "256GB"],
        [18, 4],
      ),
      categoryHandle: "demo-tech-phones-android",
      collectionHandle: "demo-tech-best-sellers",
    },
    {
      ...singleAxisProduct(
        'Refurbished 6.1" Smartphone',
        "demo-tech-iphone-13",
        "phones",
        42500,
        "Storage",
        ["128GB", "256GB"],
        [6, 0],
      ),
      categoryHandle: "demo-tech-phones-apple",
      collectionHandle: "demo-tech-best-sellers",
    },
    {
      ...singleAxisProduct(
        "Note 13 Android Phone",
        "demo-tech-redmi-note-13",
        "phones",
        18900,
        "Config",
        ["8/256", "12/512"],
        [30, 12],
      ),
      categoryHandle: "demo-tech-phones-android",
      collectionHandle: "demo-tech-new-arrivals",
    },
    {
      ...singleAxisProduct(
        'E14 14" Business Laptop',
        "demo-tech-thinkpad-e14",
        "laptops",
        68900,
        "Config",
        ["i5 16GB", "i7 32GB"],
        [8, 2],
      ),
      categoryHandle: "demo-tech-laptops-windows",
      collectionHandle: "demo-tech-wfh",
    },
    {
      ...singleAxisProduct(
        'M1 13" Ultralight Laptop',
        "demo-tech-mba-m1",
        "laptops",
        79500,
        "Config",
        ["8/256", "16/512"],
        [5, 1],
      ),
      categoryHandle: "demo-tech-laptops-mac",
      collectionHandle: "demo-tech-wfh",
    },
    // Multi-axis: color × finish (exercises product picker axes).
    {
      ...matrixProduct(
        "Wireless Earbuds Pro",
        "demo-tech-earbuds-pro",
        "audio",
        4200,
        [
          { title: "Color", values: ["Black", "White"] },
          { title: "Case", values: ["Matte", "Gloss"] },
        ],
        [25, 10, 3, 0],
      ),
      categoryHandle: "demo-tech-audio",
      collectionHandle: "demo-tech-best-sellers",
    },
    {
      ...singleAxisProduct(
        "Over-Ear Studio Headphones",
        "demo-tech-studio-headphones",
        "audio",
        6800,
        "Color",
        ["Matte Black", "Navy"],
        [14, 7],
      ),
      categoryHandle: "demo-tech-audio",
      collectionHandle: "demo-tech-new-arrivals",
    },
    {
      ...singleAxisProduct(
        "65W GaN Charger",
        "demo-tech-gan-charger",
        "accessories",
        1800,
        "Ports",
        ["USB-C", "Multi-port"],
        [50, 20],
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-new-arrivals",
    },
    {
      ...singleAxisProduct(
        "USB-C Hub 7-in-1",
        "demo-tech-usb-c-hub",
        "accessories",
        2400,
        "Finish",
        ["Space Grey", "Silver"],
        [22, 9],
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-wfh",
    },
    {
      ...singleAxisProduct(
        'Laptop Sleeve 14"',
        "demo-tech-laptop-sleeve",
        "accessories",
        950,
        "Color",
        ["Graphite", "Sand"],
        [40, 15],
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-wfh",
    },
    {
      ...singleAxisProduct(
        "Bluetooth Speaker Mini",
        "demo-tech-bt-speaker",
        "audio",
        2100,
        "Color",
        ["Charcoal", "Sage"],
        [16, 4],
      ),
      categoryHandle: "demo-tech-audio",
      collectionHandle: "demo-tech-best-sellers",
    },
    {
      ...singleAxisProduct(
        "Power Bank 20000mAh",
        "demo-tech-powerbank-20k",
        "accessories",
        2600,
        "Model",
        ["Standard", "PD Fast"],
        [28, 3],
      ),
      categoryHandle: "demo-tech-accessories",
      collectionHandle: "demo-tech-new-arrivals",
    },
  ],
};

/** Fashion shop — apparel and accessories (handle kept for shared test links). */
export const fashionShop: DemoShopDefinition = {
  ids: {
    tenant: "d2000000-0000-4000-8000-000000000001",
    domain: "d2000000-0000-4000-8000-000000000002",
    user: "d2000000-0000-4000-8000-000000000003",
    account: "d2000000-0000-4000-8000-000000000003:credential",
    membership: "d2000000-0000-4000-8000-000000000004",
    onboarding: "d2000000-0000-4000-8000-000000000005",
    storefrontRevision: "d2000000-0000-4000-8000-000000000006",
    storefrontConfig: "d2000000-0000-4000-8000-000000000007",
  },
  tenant: {
    handle: "bolestyle",
    name: "Bole Style",
  },
  user: {
    email: "liya@bolestyle.ecs.et",
    name: "Liya Tadesse",
    phone: "+251911100002",
  },
  paymentOnboarding: {
    status: "not_configured",
    notes: "Demo shop — connect Chapa in Settings when testing online pay.",
  },
  categories: [
    { name: "Women", handle: "demo-fashion-women" },
    { name: "Dresses", handle: "demo-fashion-women-dresses", parentHandle: "demo-fashion-women" },
    { name: "Tops", handle: "demo-fashion-women-tops", parentHandle: "demo-fashion-women" },
    { name: "Men", handle: "demo-fashion-men" },
    { name: "Bottoms", handle: "demo-fashion-men-bottoms", parentHandle: "demo-fashion-men" },
    { name: "Outerwear", handle: "demo-fashion-men-outerwear", parentHandle: "demo-fashion-men" },
    { name: "Footwear", handle: "demo-fashion-footwear" },
    { name: "Accessories", handle: "demo-fashion-accessories" },
  ],
  collections: [
    { title: "New Season", handle: "demo-fashion-new-season" },
    { title: "Everyday Essentials", handle: "demo-fashion-essentials" },
    { title: "Gift Picks", handle: "demo-fashion-gift-picks" },
  ],
  customers: [
    {
      firstName: "Mahi",
      lastName: "Kebede",
      email: "mahi.kebede.style@example.com",
      phone: "+251911300201",
      area: "Bole",
      address: "Bole Atlas",
    },
    {
      firstName: "Yonas",
      lastName: "Assefa",
      email: "yonas.assefa.style@example.com",
      phone: "+251911300202",
      area: "Sarbet",
      address: "Sarbet Gabriel",
    },
    {
      firstName: "Ruth",
      lastName: "Getachew",
      email: "ruth.getachew.style@example.com",
      phone: "+251911300203",
      area: "Old Airport",
      address: "Old Airport Residence",
    },
    {
      firstName: "Samuel",
      lastName: "Berhanu",
      email: "samuel.berhanu.style@example.com",
      phone: "+251911300204",
      area: "Megenagna",
      address: "Megenagna Square",
    },
    {
      firstName: "Selam",
      lastName: "Abebe",
      email: "selam.abebe.style@example.com",
      phone: "+251911300205",
      area: "Kazanchis",
      address: "Kazanchis Twin Towers",
    },
    {
      firstName: "Nahom",
      lastName: "Fikru",
      email: "nahom.fikru.style@example.com",
      phone: "+251911300206",
      area: "CMC",
      address: "CMC Summit",
    },
    {
      firstName: "Helen",
      lastName: "Worku",
      email: "helen.worku.style@example.com",
      phone: "+251911300207",
      area: "Piassa",
      address: "Piassa Churchill",
    },
    {
      firstName: "Meron",
      lastName: "Desta",
      email: "meron.desta.style@example.com",
      phone: "+251911300208",
      area: "Hayahulet",
      address: "Hayahulet Mazoria",
    },
    {
      firstName: "Eyob",
      lastName: "Solomon",
      email: "eyob.solomon.style@example.com",
      phone: "+251911300209",
      area: "Lebu",
      address: "Lebu Mebrat Hail",
    },
  ],
  products: [
    {
      ...matrixProduct(
        "Linen Midi Dress",
        "demo-fashion-linen-midi",
        "women",
        3200,
        [
          { title: "Size", values: ["S", "M", "L"] },
          { title: "Color", values: ["Ivory", "Sage"] },
        ],
        [20, 12, 8, 3, 0, 15],
      ),
      categoryHandle: "demo-fashion-women-dresses",
      collectionHandle: "demo-fashion-new-season",
    },
    {
      ...matrixProduct(
        "Cotton Wrap Blouse",
        "demo-fashion-wrap-blouse",
        "women",
        1850,
        [
          { title: "Size", values: ["S", "M", "L"] },
          { title: "Color", values: ["White", "Blush"] },
        ],
        [18, 10, 5, 2, 0, 9],
      ),
      categoryHandle: "demo-fashion-women-tops",
      collectionHandle: "demo-fashion-essentials",
    },
    {
      ...singleAxisProduct(
        "Relaxed Chino Trousers",
        "demo-fashion-chino",
        "men",
        2100,
        "Waist",
        ["30", "32", "34"],
        [14, 8, 3],
      ),
      categoryHandle: "demo-fashion-men-bottoms",
      collectionHandle: "demo-fashion-essentials",
    },
    {
      ...matrixProduct(
        "Essential Crew Tee",
        "demo-fashion-crew-tee",
        "men",
        890,
        [
          { title: "Size", values: ["S", "M", "L", "XL"] },
          { title: "Color", values: ["Black", "White", "Olive"] },
        ],
        [30, 25, 18, 10, 4, 0, 22, 15, 8, 6, 2, 12],
      ),
      categoryHandle: "demo-fashion-men",
      collectionHandle: "demo-fashion-essentials",
    },
    {
      ...singleAxisProduct(
        "Leather Crossbody Bag",
        "demo-fashion-crossbody",
        "accessories",
        4500,
        "Color",
        ["Cognac", "Black"],
        [7, 2],
      ),
      categoryHandle: "demo-fashion-accessories",
      collectionHandle: "demo-fashion-gift-picks",
    },
    {
      ...singleAxisProduct(
        "Canvas Tote",
        "demo-fashion-canvas-tote",
        "accessories",
        780,
        "Color",
        ["Natural", "Olive"],
        [40, 18],
      ),
      categoryHandle: "demo-fashion-accessories",
      collectionHandle: "demo-fashion-essentials",
    },
    {
      ...singleAxisProduct(
        "Everyday Sneakers",
        "demo-fashion-sneakers",
        "footwear",
        3600,
        "EU Size",
        ["40", "42", "44"],
        [10, 4, 0],
      ),
      categoryHandle: "demo-fashion-footwear",
      collectionHandle: "demo-fashion-new-season",
    },
    {
      ...singleAxisProduct(
        "Ankle Boots",
        "demo-fashion-ankle-boots",
        "footwear",
        5200,
        "EU Size",
        ["38", "40", "42"],
        [6, 3, 1],
      ),
      categoryHandle: "demo-fashion-footwear",
      collectionHandle: "demo-fashion-gift-picks",
    },
    {
      ...singleAxisProduct(
        "Silk Scarf Print",
        "demo-fashion-silk-scarf",
        "accessories",
        1200,
        "Color",
        ["Ivory", "Indigo"],
        [22, 9],
      ),
      categoryHandle: "demo-fashion-accessories",
      collectionHandle: "demo-fashion-gift-picks",
    },
    {
      ...matrixProduct(
        "Structured Blazer",
        "demo-fashion-blazer",
        "women",
        4800,
        [
          { title: "Size", values: ["S", "M", "L"] },
          { title: "Color", values: ["Navy", "Camel"] },
        ],
        [8, 5, 2, 0, 4, 1],
      ),
      categoryHandle: "demo-fashion-women-tops",
      collectionHandle: "demo-fashion-new-season",
    },
    {
      ...singleAxisProduct(
        "Denim Jacket",
        "demo-fashion-denim-jacket",
        "men",
        3900,
        "Size",
        ["M", "L", "XL"],
        [11, 6, 2],
      ),
      categoryHandle: "demo-fashion-men-outerwear",
      collectionHandle: "demo-fashion-new-season",
    },
    {
      ...singleAxisProduct(
        "Gift Card Bundle Box",
        "demo-fashion-gift-box",
        "accessories",
        2500,
        "Tier",
        ["Classic", "Premium"],
        [50, 20],
      ),
      categoryHandle: "demo-fashion-accessories",
      collectionHandle: "demo-fashion-gift-picks",
    },
  ],
};

export const demoShops = [techShop, fashionShop] as const;

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
