/**
 * Demo seed definitions: two Ethiopian shops (tech + fashion), separate owners.
 * Stable IDs keep re-seeds idempotent.
 */

export type DemoCustomer = {
  address: string;
  area: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type DemoProductVariant = {
  option: string;
  price: number;
  sku: string;
  title: string;
};

export type DemoProduct = {
  description: string;
  handle: string;
  imageCategory: string;
  optionTitle: string;
  title: string;
  variants: DemoProductVariant[];
};

export type DemoShopDefinition = {
  categories: ReadonlyArray<{ handle: string; name: string }>;
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

function product(
  title: string,
  handle: string,
  imageCategory: string,
  basePrice: number,
  options: readonly string[],
  description?: string,
): DemoProduct {
  return {
    title,
    handle,
    imageCategory,
    description:
      description ??
      `${title} — curated for Ethiopian shoppers. Local delivery and cash on delivery ready.`,
    optionTitle: "Variant",
    variants: options.map((option, index) => ({
      option,
      title: `${title} / ${option}`,
      sku: `${handle.toUpperCase().replaceAll("-", "_")}_${index + 1}`,
      price: basePrice + index * Math.round(basePrice * 0.35),
    })),
  };
}

export const DEMO_SEED_MARKER = "ecs-demo-v2";
export const DEMO_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "password1234";

/** Tech shop — phones, laptops, accessories. */
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
    handle: "addis-tech",
    name: "Addis Tech Hub",
  },
  user: {
    email: "owner@addis-tech.local",
    name: "Yonatan Bekele",
    phone: "+251911100001",
  },
  categories: [
    { name: "Phones", handle: "demo-tech-phones" },
    { name: "Laptops", handle: "demo-tech-laptops" },
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
  ],
  products: [
    product("Galaxy A35 5G", "demo-tech-galaxy-a35", "phones", 28900, ["128GB", "256GB"]),
    product("iPhone 13 Refurbished", "demo-tech-iphone-13", "phones", 42500, ["128GB", "256GB"]),
    product("Redmi Note 13", "demo-tech-redmi-note-13", "phones", 18900, ["8/256", "12/512"]),
    product("ThinkPad E14 Gen 5", "demo-tech-thinkpad-e14", "laptops", 68900, ["i5 16GB", "i7 32GB"]),
    product("MacBook Air M1", "demo-tech-mba-m1", "laptops", 79500, ["8/256", "16/512"]),
    product("Wireless Earbuds Pro", "demo-tech-earbuds-pro", "audio", 4200, ["Black", "White"]),
    product("Over-Ear Studio Headphones", "demo-tech-studio-headphones", "audio", 6800, [
      "Matte Black",
      "Navy",
    ]),
    product("65W GaN Charger", "demo-tech-gan-charger", "accessories", 1800, ["USB-C", "Multi-port"]),
    product("USB-C Hub 7-in-1", "demo-tech-usb-c-hub", "accessories", 2400, ["Space Grey", "Silver"]),
    product("Laptop Sleeve 14\"", "demo-tech-laptop-sleeve", "accessories", 950, ["Graphite", "Sand"]),
    product("Bluetooth Speaker Mini", "demo-tech-bt-speaker", "audio", 2100, ["Charcoal", "Sage"]),
    product("Power Bank 20000mAh", "demo-tech-powerbank-20k", "accessories", 2600, [
      "Standard",
      "PD Fast",
    ]),
  ],
};

/** Fashion shop — apparel and accessories. */
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
    handle: "bole-style",
    name: "Bole Style",
  },
  user: {
    email: "owner@bole-style.local",
    name: "Liya Tadesse",
    phone: "+251911100002",
  },
  categories: [
    { name: "Women", handle: "demo-fashion-women" },
    { name: "Men", handle: "demo-fashion-men" },
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
  ],
  products: [
    product("Linen Midi Dress", "demo-fashion-linen-midi", "women", 3200, ["S", "M", "L"]),
    product("Cotton Wrap Blouse", "demo-fashion-wrap-blouse", "women", 1850, ["S", "M", "L"]),
    product("Relaxed Chino Trousers", "demo-fashion-chino", "men", 2100, ["30", "32", "34"]),
    product("Essential Crew Tee", "demo-fashion-crew-tee", "men", 890, ["S", "M", "L", "XL"]),
    product("Leather Crossbody Bag", "demo-fashion-crossbody", "accessories", 4500, [
      "Cognac",
      "Black",
    ]),
    product("Canvas Tote", "demo-fashion-canvas-tote", "accessories", 780, ["Natural", "Olive"]),
    product("Everyday Sneakers", "demo-fashion-sneakers", "footwear", 3600, ["40", "42", "44"]),
    product("Ankle Boots", "demo-fashion-ankle-boots", "footwear", 5200, ["38", "40", "42"]),
    product("Silk Scarf Print", "demo-fashion-silk-scarf", "accessories", 1200, ["Ivory", "Indigo"]),
    product("Structured Blazer", "demo-fashion-blazer", "women", 4800, ["S", "M", "L"]),
    product("Denim Jacket", "demo-fashion-denim-jacket", "men", 3900, ["M", "L", "XL"]),
    product("Gift Card Bundle Box", "demo-fashion-gift-box", "accessories", 2500, [
      "Classic",
      "Premium",
    ]),
  ],
};

export const demoShops = [techShop, fashionShop] as const;

export function demoImageUrl(category: string) {
  const customBase = process.env.SEED_DEMO_IMAGE_BASE?.trim().replace(/\/$/, "");
  const seed = `ecs-${category}`;
  if (customBase) {
    return `${customBase}/${encodeURIComponent(seed)}/1200/1200`;
  }
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/1200`;
}
