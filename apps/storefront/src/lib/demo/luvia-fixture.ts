import aboutImage from "../../templates/luvia/v1/assets/about-feature-image.webp";
import brandImage from "../../templates/luvia/v1/assets/brand-statement-image.webp";
import categoryPreview from "../../templates/luvia/v1/assets/category-preview-image.webp";
import heroPortrait from "../../templates/luvia/v1/assets/hero-portrait-image.webp";
import type {
  StoreCart,
  StoreCategory,
  StoreCollection,
  StoreDeliveryOptions,
  StoreProduct,
  StoreShippingOption,
} from "../commerce/types";
import type { LastOrderCookie } from "../session/cart-cookie";

export const luviaDemoCollections: StoreCollection[] = [
  { id: "demo-cleansers", title: "Cleansers", handle: "cleansers", mediaUrl: heroPortrait.src },
  { id: "demo-serums", title: "Serums", handle: "serums", mediaUrl: categoryPreview.src },
  { id: "demo-moisturisers", title: "Moisturisers", handle: "moisturisers", mediaUrl: aboutImage.src },
  { id: "demo-body", title: "Body care", handle: "body-care", mediaUrl: brandImage.src },
];

export const luviaDemoCategories: StoreCategory[] = luviaDemoCollections.map((collection) => ({
  id: `category-${collection.id}`,
  name: collection.title,
  handle: collection.handle,
  parentCategoryId: null,
  mediaUrl: collection.mediaUrl,
}));

const productSeeds = [
  ["gentle-cleanser", "Gentle Botanical Cleanser", 1_250, heroPortrait.src, 0, false],
  ["radiance-serum", "Radiance Vitamin Serum", 1_780, categoryPreview.src, 1, false],
  ["barrier-cream", "Daily Barrier Cream", 1_490, aboutImage.src, 2, false],
  ["body-oil", "Nourishing Body Oil", 1_320, brandImage.src, 3, false],
  ["night-serum", "Renewal Night Serum", 1_950, heroPortrait.src, 1, false],
  ["face-mist", "Botanical Face Mist", 980, categoryPreview.src, 2, false],
  ["velvet-lipstick", "Velvet Matte Lip Color", 1_750, categoryPreview.src, 1, true], // SOLD OUT test
] as const;

export const luviaDemoProducts: StoreProduct[] = productSeeds.map(
  ([handle, title, priceAmount, thumbnail, collectionIndex, isSoldOut], index) => {
    const collection = luviaDemoCollections[collectionIndex];
    const originalPriceAmount = index === 1 ? 2_050 : index === 4 ? 2_450 : null;
    const discountPercentage =
      originalPriceAmount != null && originalPriceAmount > priceAmount
        ? Math.round(((originalPriceAmount - priceAmount) / originalPriceAmount) * 100)
        : null;
    const discountAmount =
      originalPriceAmount != null && originalPriceAmount > priceAmount
        ? originalPriceAmount - priceAmount
        : null;

    return {
      id: `demo-product-${index + 1}`,
      title,
      handle,
      description: isSoldOut
        ? "Formulated with wild botanicals and natural mineral pigments. Currently sold out.\n\n### Highlights\n- Deep pigment payoff\n- Non-drying nourishing botanical base"
        : "A considered daily essential made for a calm, radiant skincare routine. Gentle textures and thoughtfully selected ingredients make it easy to use every day.\n\n### Highlights\n- 100% Vegan & cruelty-free\n- Formulated for high-altitude skin barrier protection",
      thumbnail,
      images: [thumbnail],
      gallery: [{ url: thumbnail }],
      variants: [
        {
          id: `demo-variant-${index + 1}`,
          title: "Standard",
          sku: `LUV-${String(index + 1).padStart(3, "0")}`,
          manageInventory: true,
          allowBackorder: false,
          inventoryQuantity: isSoldOut ? 0 : 12,
          inStock: !isSoldOut,
          priceAmount,
          originalPriceAmount,
          discountAmount,
          discountPercentage,
          currencyCode: "ETB",
          optionValues: [],
        },
      ],
      options: [],
      collectionId: collection?.id ?? null,
      collectionTitle: collection?.title ?? null,
      categoryIds: collection ? [`category-${collection.id}`] : [],
      priceAmount,
      originalPriceAmount,
      discountAmount,
      discountPercentage,
      currencyCode: "ETB",
    };
  },
);

export const luviaDemoCart: StoreCart = {
  id: "demo-cart",
  regionId: "demo-ethiopia",
  email: "selam@example.com",
  currencyCode: "ETB",
  subtotal: 3_030,
  itemTotal: 3_030,
  itemSubtotal: 3_030,
  itemDiscountTotal: 0,
  shippingTotal: 150,
  shippingSubtotal: 150,
  shippingDiscountTotal: 0,
  taxTotal: 0,
  discountTotal: 0,
  originalTotal: 3_180,
  total: 3_180,
  promotions: [],
  items: [luviaDemoProducts[1], luviaDemoProducts[0]].map((product, index) => ({
    id: `demo-line-${index + 1}`,
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

export const luviaDemoDelivery: StoreDeliveryOptions = {
  deliveryEnabled: true,
  pickupEnabled: true,
  phoneConfirmationRequired: true,
  notesEnabled: true,
  landmarkRequired: false,
  defaultDeliveryFee: "150",
  currency: "ETB",
  zones: [],
};

export const luviaDemoShippingOptions: StoreShippingOption[] = [
  { id: "demo-delivery", name: "Addis Ababa delivery", amount: 150, currencyCode: "ETB" },
  { id: "demo-pickup", name: "Store pickup", amount: 0, currencyCode: "ETB" },
];

export const luviaDemoOrder: LastOrderCookie = {
  currencyCode: "ETB",
  id: "order_demo_luvia_1048",
  total: 3_180,
};

export function findLuviaDemoProduct(handle: string) {
  return luviaDemoProducts.find((product) => product.handle === handle) ?? null;
}

/**
 * Demo-only contact details. The template defaults deliberately leave
 * phone/email/address undefined so a legacy tenant without valid shopDetails
 * cannot publish someone else's contact info; the demo needs its own copy.
 */
export const luviaDemoFooterContact = {
  phone: "+251 91 110 0002",
  email: "hello@bolestyle.com",
  address: "Bole Road, Woreda 3, Jomo Building, 2nd Floor, Addis Ababa, Ethiopia",
};
