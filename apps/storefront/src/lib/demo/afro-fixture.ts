import product1 from "../../templates/afro/v1/assets/product-1.png";
import product2 from "../../templates/afro/v1/assets/product-2.png";
import product3 from "../../templates/afro/v1/assets/product-3.png";
import product4 from "../../templates/afro/v1/assets/product-4.png";
import product5 from "../../templates/afro/v1/assets/product-5.png";
import product6 from "../../templates/afro/v1/assets/product-6.png";
import product7 from "../../templates/afro/v1/assets/product-7.png";
import product8 from "../../templates/afro/v1/assets/product-8.png";
import product9 from "../../templates/afro/v1/assets/product-9.png";
import product10 from "../../templates/afro/v1/assets/product-10.png";
import bgJackets from "../../templates/afro/v1/assets/bg-jackets.png";
import bgShirts from "../../templates/afro/v1/assets/bg-shirts.png";
import bgTrousers from "../../templates/afro/v1/assets/bg-trousers.png";
import bgAccessories from "../../templates/afro/v1/assets/bg-accessories.png";
import womenCollection from "../../templates/afro/v1/assets/women-collection.png";
import menCollection from "../../templates/afro/v1/assets/men-collection.png";

import type { StoreCart, StoreCategory, StoreCollection, StoreDeliveryOptions, StoreProduct, StoreShippingOption } from "../commerce/types";
import type { LastOrderCookie } from "../session/cart-cookie";

export const afroDemoCollections: StoreCollection[] = [
  { id: "demo-women", title: "Women's Collection", handle: "women", mediaUrl: womenCollection.src },
  { id: "demo-men", title: "Men's Collection", handle: "men", mediaUrl: menCollection.src },
  { id: "demo-kids", title: "Kids' Collection", handle: "kids", mediaUrl: womenCollection.src },
  { id: "demo-accessories", title: "Accessories Collection", handle: "accessories", mediaUrl: bgAccessories.src },
];

export const afroDemoCategories: StoreCategory[] = [
  { id: "category-jackets", name: "Jackets & Outerwear", handle: "jackets", parentCategoryId: null, mediaUrl: bgJackets.src },
  { id: "category-tshirts", name: "T-Shirts & Tops", handle: "tshirts", parentCategoryId: null, mediaUrl: bgShirts.src },
  { id: "category-trousers", name: "Trousers & Denim", handle: "trousers", parentCategoryId: null, mediaUrl: bgTrousers.src },
  { id: "category-shirts", name: "Shirts", handle: "shirts", parentCategoryId: null, mediaUrl: bgShirts.src },
  { id: "category-sets", name: "Sets & Tracksuits", handle: "sets", parentCategoryId: null, mediaUrl: product9.src },
  { id: "category-accessories", name: "Accessories", handle: "accessories", parentCategoryId: null, mediaUrl: bgAccessories.src },
];

const productSeeds = [
  [
    "suede-zip-jacket",
    "Suede Zip Jacket",
    10_240,
    12_310,
    product1.src,
    "jackets",
    1,
    "Precision-crafted from premium supple goat suede with a clean minimal collar, satin interior lining, and custom brushed gunmetal hardware. Designed for a sharp silhouette that transitions effortlessly across every season.",
  ],
  [
    "relaxed-wool-trousers",
    "Relaxed Wool Trousers",
    7_850,
    9_500,
    product3.src,
    "trousers",
    1,
    "Tailored with comfortable ease, these relaxed wool trousers feature front pleats, slanted pockets, and a refined drape suitable for formal and casual settings alike.",
  ],
  [
    "straight-leg-denim-jeans",
    "Straight-Leg Denim Jeans",
    4_950,
    6_200,
    product4.src,
    "trousers",
    1,
    "Classic straight-leg cut crafted from heavyweight selvedge denim. Finished with authentic copper hardware and vintage wash detailing.",
  ],
  [
    "oxford-cotton-shirt",
    "Oxford Cotton Shirt",
    5_430,
    6_800,
    product5.src,
    "shirts",
    0,
    "Woven from pure long-staple organic cotton, this timeless Oxford shirt features mother-of-pearl buttons and a comfortable regular fit.",
  ],
  [
    "utilitarian-overshirt",
    "Utilitarian Overshirt",
    5_990,
    7_200,
    product2.src,
    "jackets",
    1,
    "A versatile layering piece designed with functional patch pockets, point collar, and concealed snap closures in durable twill cotton.",
  ],
  [
    "camp-collar-linen-shirt",
    "Camp-Collar Linen Shirt",
    4_200,
    5_600,
    product6.src,
    "shirts",
    0,
    "Breezy, lightweight camp-collar shirt cut from breathable French linen. Perfect for warmer climates and easygoing summer styling.",
  ],
  [
    "down-quilted-puffer",
    "Down Quilted Puffer",
    14_800,
    18_500,
    product7.src,
    "jackets",
    0,
    "High-loft down insulation encased in water-repellent ripstop shell. Delivers superior warmth and wind resistance in cold conditions.",
  ],
  [
    "club-graphic-t-shirt",
    "Club Graphic T-Shirt",
    2_650,
    3_400,
    product8.src,
    "tshirts",
    2,
    "Everyday classic crewneck crafted from soft mid-weight cotton jersey featuring minimalist embroidered heritage branding.",
  ],
  [
    "sst-3-stripes-tracksuit",
    "SST 3-Stripes Tracksuit",
    8_900,
    11_200,
    product9.src,
    "sets",
    1,
    "Iconic track jacket and pants set made with recycled tricot fabric, ribbed details, and signature 3-stripes down the sleeves and legs.",
  ],
  [
    "sherpa-corduroy-jacket",
    "Sherpa Corduroy Jacket",
    11_500,
    14_000,
    product10.src,
    "jackets",
    1,
    "Chunky ridge corduroy exterior lined with plush sherpa fleece. Features dual chest flap pockets and reinforced stitching.",
  ],
  [
    "leather-crossbody-pouch",
    "Leather Crossbody Pouch",
    6_200,
    7_500,
    bgAccessories.src,
    "accessories",
    3,
    "Supple nappa leather crossbody bag with minimalist hardware and knotted shoulder strap.",
  ],
  [
    "cotton-minimalist-beanie",
    "Cotton Minimalist Beanie",
    1_850,
    2_400,
    bgAccessories.src,
    "accessories",
    3,
    "Ribbed organic cotton watch cap beanie with subtle tonal brand woven label.",
  ],
] as const;

export const afroDemoProducts: StoreProduct[] = productSeeds.map(([handle, title, priceAmount, originalPriceAmount, thumbnail, catHandle, colIdx, description], index) => {
  const collection = afroDemoCollections[colIdx];
  const category = afroDemoCategories.find((c) => c.handle === catHandle);

  return {
    id: `afro-demo-product-${index + 1}`,
    title,
    handle,
    description,
    thumbnail,
    images: [thumbnail],
    gallery: [{ url: thumbnail }],
    variants: [
      {
        id: `afro-demo-variant-${index + 1}`,
        title: "Default",
        sku: `AFR-${String(index + 1).padStart(3, "0")}`,
        manageInventory: true,
        allowBackorder: false,
        inventoryQuantity: 15,
        inStock: true,
        priceAmount,
        originalPriceAmount,
        discountAmount: originalPriceAmount ? originalPriceAmount - priceAmount : null,
        discountPercentage: originalPriceAmount ? Math.round(((originalPriceAmount - priceAmount) / originalPriceAmount) * 100) : null,
        currencyCode: "ETB",
        optionValues: [],
      },
    ],
    options: [],
    collectionId: collection?.id ?? null,
    collectionTitle: collection?.title ?? null,
    categoryIds: category ? [category.id] : [],
    priceAmount,
    originalPriceAmount,
    discountAmount: originalPriceAmount ? originalPriceAmount - priceAmount : null,
    discountPercentage: originalPriceAmount ? Math.round(((originalPriceAmount - priceAmount) / originalPriceAmount) * 100) : null,
    currencyCode: "ETB",
  };
});

export const afroDemoCart: StoreCart = {
  id: "afro-demo-cart",
  regionId: "demo-ethiopia",
  email: "selam@afrostudio.ecs.et",
  currencyCode: "ETB",
  subtotal: 18_090,
  itemTotal: 18_090,
  itemSubtotal: 18_090,
  itemDiscountTotal: 0,
  shippingTotal: 0,
  shippingSubtotal: 0,
  shippingDiscountTotal: 0,
  taxTotal: 0,
  discountTotal: 0,
  originalTotal: 18_090,
  total: 18_090,
  promotions: [],
  items: [afroDemoProducts[0], afroDemoProducts[1]].map((product, index) => ({
    id: `afro-demo-line-${index + 1}`,
    title: product?.title ?? "Product",
    quantity: 1,
    unitPrice: product?.priceAmount ?? 0,
    total: product?.priceAmount ?? 0,
    thumbnail: product?.thumbnail ?? null,
    variantId: product?.variants[0]?.id ?? null,
    productHandle: product?.handle ?? null,
    variantTitle: product?.variants[0]?.title ?? null,
    subtotal: product?.priceAmount ?? 0,
    discountTotal: 0,
    originalTotal: product?.priceAmount ?? 0,
  })),
};

export const afroDemoDelivery: StoreDeliveryOptions = {
  deliveryEnabled: true,
  pickupEnabled: true,
  phoneConfirmationRequired: true,
  notesEnabled: true,
  landmarkRequired: false,
  defaultDeliveryFee: "0",
  currency: "ETB",
  zones: [],
};

export const afroDemoShippingOptions: StoreShippingOption[] = [
  { id: "afro-demo-delivery", name: "Standard Delivery (Addis Ababa)", amount: 0, currencyCode: "ETB" },
  { id: "afro-demo-express", name: "Express Delivery (Same Day)", amount: 200, currencyCode: "ETB" },
];

export const afroDemoOrder: LastOrderCookie = {
  currencyCode: "ETB",
  id: "order_demo_afrostudio_1024",
  total: 18_090,
};

export function findAfroDemoProduct(handle: string) {
  return afroDemoProducts.find((p) => p.handle === handle) ?? null;
}
