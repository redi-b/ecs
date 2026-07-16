export type StorefrontError = {
  ok: false;
  status: number;
  message: string;
};

export type StorefrontFetch = (request: Request) => Promise<Response>;

export type HostedStoreRequest = {
  fetcher?: StorefrontFetch;
  platformApiBaseUrl: string;
  requestHost?: string | null;
};

export type StoreProductVariant = {
  id: string;
  title: string | null;
  sku: string | null;
  manageInventory: boolean;
  allowBackorder: boolean;
  inventoryQuantity: number | null;
  inStock: boolean;
  priceAmount: number | null;
  currencyCode: string | null;
  optionValues: Array<{ optionTitle: string; value: string }>;
};

export type StoreProduct = {
  id: string;
  title: string | null;
  handle: string | null;
  description: string | null;
  thumbnail: string | null;
  images: string[];
  variants: StoreProductVariant[];
  priceAmount: number | null;
  currencyCode: string | null;
};

export type StoreProductsResponse = {
  products: StoreProduct[];
  count?: number;
  limit?: number;
  offset?: number;
};

export type StoreDeliveryOptions = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  phoneConfirmationRequired: boolean;
  notesEnabled: boolean;
  landmarkRequired: boolean;
  defaultDeliveryFee: string;
  currency: string;
  zones: unknown[];
};

export type StoreDeliveryOptionsResponse = {
  delivery: StoreDeliveryOptions;
};

export type StoreCartItem = {
  id: string;
  title: string | null;
  quantity: number;
  unitPrice: number | null;
  total: number | null;
  thumbnail: string | null;
  variantId: string | null;
  productHandle: string | null;
  variantTitle: string | null;
};

export type StoreCart = {
  id: string;
  regionId: string | null;
  email: string | null;
  currencyCode: string | null;
  itemTotal: number | null;
  shippingTotal: number | null;
  total: number | null;
  items: StoreCartItem[];
};

export type StoreCartResponse = {
  cart: StoreCart;
};

export type StoreShippingOption = {
  id: string;
  name: string | null;
  amount: number | null;
  currencyCode: string | null;
};

export type StoreShippingOptionsResponse = {
  shippingOptions: StoreShippingOption[];
};

export type StorePaymentOptions = {
  cod: boolean;
  chapa: boolean;
};

export type CodCheckoutInput = {
  cartId: string;
  shippingOptionId: string;
  deliveryChoice: "delivery" | "pickup";
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  };
  address: {
    address1: string;
    city: string;
    landmark?: string | null;
  };
  notes?: string | null;
};

export type CompletedOrder = {
  id: string;
  displayId: string | null;
  total: number | null;
  currencyCode: string | null;
  email: string | null;
};

export type CodCheckoutResponse = {
  order: CompletedOrder;
};

export type ChapaCheckoutResponse = {
  checkoutUrl: string;
  paymentSessionId: string | null;
};
