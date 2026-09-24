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
  { id: "demo-accessories", title: "Accessories Collection", handle: "accessories", mediaUrl: bgAccessories.src },
];

export const afroDemoCategories: StoreCategory[] = [
  { id: "category-jackets", name: "Jackets & Outerwear", handle: "jackets", parentCategoryId: null, mediaUrl: bgJackets.src },
  { id: "category-tshirts", name: "T-Shirts & Tops", handle: "tshirts", parentCategoryId: null, mediaUrl: bgShirts.src },
  { id: "category-trousers", name: "Trousers & Denim", handle: "trousers", parentCategoryId: null, mediaUrl: bgTrousers.src },
  { id: "category-accessories", name: "Accessories", handle: "accessories", parentCategoryId: null, mediaUrl: bgAccessories.src },
];

const productSeeds = [
  ["suede-zip-jacket", "Suede Zip Jacket", 10_240, product1.src, "jackets", 1],
  ["relaxed-wool-trousers", "Relaxed Wool Trousers", 7_850, product2.src, "trousers", 1],
  ["heavyweight-box-tee", "Heavyweight Box Tee", 3_400, product3.src, "tshirts", 0],
  ["structured-overshirt", "Structured Overshirt", 6_200, product4.src, "jackets", 1],
  ["tailored-linen-shirt", "Tailored Linen Shirt", 5_600, product5.src, "tshirts", 0],
  ["leather-crossbody-bag", "Leather Crossbody Bag", 8_900, product6.src, "accessories", 2],
  ["wool-blend-cardigan", "Wool Blend Cardigan", 9_100, product7.src, "jackets", 0],
  ["pleated-wide-trousers", "Pleated Wide Trousers", 8_200, product8.src, "trousers", 0],
  ["minimalist-leather-belt", "Minimalist Leather Belt", 2_400, product9.src, "accessories", 2],
  ["everyday-cotton-crewneck", "Everyday Cotton Crewneck", 4_500, product10.src, "tshirts", 1],
] as const;

export const afroDemoProducts: StoreProduct[] = productSeeds.map(([handle, title, priceAmount, thumbnail, catHandle, colIdx], index) => {
  const collection = afroDemoCollections[colIdx];
  const category = afroDemoCategories.find((c) => c.handle === catHandle);
  const originalPriceAmount = index === 0 ? 12_000 : null;

  return {
    id: `afro-demo-product-${index + 1}`,
    title,
    handle,
    description: "Thoughtfully crafted apparel designed for everyday rhythm and timeless ease. Premium materials tailored for modern style.",
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
        discountPercentage: originalPriceAmount ? 15 : null,
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
    discountPercentage: originalPriceAmount ? 15 : null,
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
