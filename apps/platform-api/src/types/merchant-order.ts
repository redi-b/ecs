export type MerchantOrderDelivery = {
  choice: string | null;
  customerName: string | null;
  customerPhone: string | null;
  landmark: string | null;
  notes: string | null;
};

export type MerchantOrderPaymentMethod = "cod" | "chapa" | "unknown";

/** Merchant-facing progress (not Medusa jargon). */
export type MerchantOrderProgressFilter =
  | "new"
  | "ready"
  | "completed"
  | "canceled"
  | "open";

export type MerchantOrderPaymentFilter = "unpaid" | "paid" | "failed";

export type MerchantOrderMethodFilter = "cod" | "chapa";

export type MerchantOrderDeliveryFilter = "delivery" | "pickup";

export type MerchantOrderCreatedPreset = "today" | "last_7_days" | "last_30_days";

export type MerchantOrderListQuery = {
  created?: MerchantOrderCreatedPreset | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  delivery?: MerchantOrderDeliveryFilter | undefined;
  limit: number;
  offset: number;
  paymentMethod?: MerchantOrderMethodFilter | undefined;
  paymentStatus?: MerchantOrderPaymentFilter | undefined;
  progress?: MerchantOrderProgressFilter | undefined;
  q?: string | undefined;
  salesChannelId: string;
};

export type MerchantOrder = {
  id: string;
  displayId: number | null;
  email: string | null;
  customerId?: string | null;
  status: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  paymentMethod?: MerchantOrderPaymentMethod | null;
  paymentReference?: string | null;
  note?: string | null;
  currencyCode: string | null;
  total: number | null;
  subtotal?: number | null;
  shippingTotal?: number | null;
  discountTotal?: number | null;
  itemCount?: number | null;
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
  /** Line display title (often product name). */
  title: string | null;
  /** Product name when Medusa separates product vs variant. */
  productTitle?: string | null;
  /** Variant options / title (Size, Color, SKU label). */
  variantTitle?: string | null;
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

export type MerchantOrderAction =
  | "cancel"
  | "complete"
  | "deliver"
  | "fulfill"
  | "mark-paid"
  | "recheck-payment"
  | "finish";

export type MerchantOrderActionResult = MerchantOrderDetailResult;

export type MerchantOrderMutateInput = {
  action: MerchantOrderAction;
  fulfillmentId?: string | undefined;
  markPaid?: boolean | undefined;
  orderId: string;
  salesChannelId: string;
  shippingOptionId?: string | undefined;
  stockLocationId?: string | undefined;
};
