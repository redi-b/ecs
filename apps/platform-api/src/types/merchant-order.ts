export type MerchantOrderDelivery = {
  choice: string | null;
  customerName: string | null;
  customerPhone: string | null;
  landmark: string | null;
  notes: string | null;
};

export type MerchantOrder = {
  id: string;
  displayId: number | null;
  email: string | null;
  status: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  currencyCode: string | null;
  total: number | null;
  delivery?: MerchantOrderDelivery;
  fulfillments?: MerchantOrderFulfillment[];
  items?: MerchantOrderLineItem[];
  shippingAddress?: MerchantOrderAddress;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantOrderAddress = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  countryCode: string | null;
};

export type MerchantOrderFulfillment = {
  id: string;
  deliveredAt: string | null;
  shippedAt: string | null;
  canceledAt: string | null;
};

export type MerchantOrderLineItem = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  title: string | null;
  quantity: number | null;
  fulfilledQuantity?: number | null;
  unitPrice: number | null;
  total: number | null;
  thumbnail: string | null;
};

export type MerchantOrdersResult =
  | {
      ok: true;
      count: number;
      limit: number;
      offset: number;
      orders: MerchantOrder[];
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type MerchantOrderDetailResult =
  | {
      ok: true;
      order: MerchantOrder;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing"
        | "inventory_location_unavailable"
        | "order_fulfillment_not_found"
        | "order_not_found"
        | "order_not_fulfillable";
      status: 401 | 404 | 409 | 503;
    };

export type MerchantOrderAction = "cancel" | "complete" | "deliver" | "fulfill";

export type MerchantOrderActionResult = MerchantOrderDetailResult;
