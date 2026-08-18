import { asError, storeFetch } from "./http.js";
import type { HostedStoreRequest, StorefrontError } from "./types.js";

export type StoreCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type StoreCustomerOrder = {
  id: string;
  displayId: number | null;
  customDisplayId: string | null;
  createdAt: string | null;
  status: string;
  currencyCode: string | null;
  total: number | null;
  itemCount: number;
};

export type StoreCustomerOrderItem = {
  id: string;
  title: string;
  variantTitle: string;
  thumbnail: string | null;
  quantity: number;
  unitPrice: number | null;
  total: number | null;
};

export type StoreCustomerOrderAddress = {
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
};

export type StoreCustomerOrderDetail = StoreCustomerOrder & {
  items: StoreCustomerOrderItem[];
  subtotal: number | null;
  shippingTotal: number | null;
  taxTotal: number | null;
  discountTotal: number | null;
  shippingAddress: StoreCustomerOrderAddress | null;
  shippingMethod: string | null;
  fulfillmentState: "received" | "preparing" | "shipped" | "delivered" | "cancelled";
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type CustomerAccountView = {
  customer: StoreCustomer;
  orders: StoreCustomerOrder[];
  orderCount: number;
  orderLimit: number;
  orderOffset: number;
};

export async function authenticateStoreCustomer(
  options: HostedStoreRequest & {
    mode: "login" | "register";
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<{ token: string } | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/customer-auth/${options.mode}`,
    method: "POST",
    body: {
      email: options.email,
      password: options.password,
      ...(options.mode === "register"
        ? { firstName: options.firstName, lastName: options.lastName }
        : {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return asError(response.status, data, "Unable to sign in.");
  const token = recordString(data, "token");
  return token ? { token } : asError(502, data, "Invalid account response.");
}

export async function getCustomerAccount(
  options: HostedStoreRequest & { token: string; orderLimit?: number; orderOffset?: number },
): Promise<CustomerAccountView | StorefrontError> {
  const headers = { authorization: `Bearer ${options.token}` };
  const [customerResponse, ordersResponse] = await Promise.all([
    storeFetch({ ...options, path: "/store/customer/me", headers }),
    storeFetch({ ...options, path: "/store/customer/orders", headers, searchParams: { limit: options.orderLimit ?? 10, offset: options.orderOffset ?? 0 } }),
  ]);
  const customerData = await customerResponse.json().catch(() => null);
  if (!customerResponse.ok) return asError(customerResponse.status, customerData, "Your session has expired.");
  const ordersData = await ordersResponse.json().catch(() => null);
  if (!ordersResponse.ok) return asError(ordersResponse.status, ordersData, "Order history is unavailable.");

  const customer = normalizeCustomer(customerData);
  if (!customer) {
    return asError(502, customerData, "Invalid customer response.");
  }

  const rawOrders = isRecord(ordersData) && Array.isArray(ordersData.orders) ? ordersData.orders : [];
  return {
    customer,
    orders: rawOrders.filter(isRecord).map(normalizeOrder),
    orderCount: isRecord(ordersData) && typeof ordersData.count === "number" ? ordersData.count : rawOrders.length,
    orderLimit: isRecord(ordersData) && typeof ordersData.limit === "number" ? ordersData.limit : options.orderLimit ?? 10,
    orderOffset: isRecord(ordersData) && typeof ordersData.offset === "number" ? ordersData.offset : options.orderOffset ?? 0,
  };
}

export async function getStoreCustomer(
  options: HostedStoreRequest & { token: string },
): Promise<StoreCustomer | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/customer/me",
    headers: { authorization: `Bearer ${options.token}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return asError(response.status, data, "Your session has expired.");
  return normalizeCustomer(data) ?? asError(502, data, "Invalid customer response.");
}

export async function updateStoreCustomer(
  options: HostedStoreRequest & {
    token: string;
    firstName: string;
    lastName: string;
    phone: string;
  },
): Promise<StoreCustomer | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/customer/profile",
    method: "POST",
    headers: { authorization: `Bearer ${options.token}` },
    body: {
      firstName: options.firstName,
      lastName: options.lastName,
      phone: options.phone,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return asError(response.status, data, "We could not update your profile.");
  return normalizeCustomer(data) ?? asError(502, data, "Invalid customer response.");
}

export async function getCustomerOrder(
  options: HostedStoreRequest & { token: string; orderId: string },
): Promise<StoreCustomerOrderDetail | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/customer/orders/${encodeURIComponent(options.orderId)}`,
    headers: { authorization: `Bearer ${options.token}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return asError(response.status, data, "We could not find that order.");
  const order = isRecord(data) && isRecord(data.order) ? data.order : null;
  return order ? normalizeOrderDetail(order) : asError(502, data, "Invalid order response.");
}

export async function transferStoreCartToCustomer(
  options: HostedStoreRequest & { token: string; cartId: string },
): Promise<true | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}/customer`,
    method: "POST",
    headers: { authorization: `Bearer ${options.token}` },
  });
  if (response.ok) return true;
  return asError(response.status, await response.json().catch(() => null), "Unable to connect your cart to your account.");
}

function normalizeOrder(order: Record<string, unknown>): StoreCustomerOrder {
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    id: recordString(order, "id") ?? "",
    displayId: typeof order.display_id === "number" ? order.display_id : null,
    customDisplayId: recordString(order, "custom_display_id"),
    createdAt: recordString(order, "created_at"),
    status: recordString(order, "status") ?? "pending",
    currencyCode: recordString(order, "currency_code"),
    total: typeof order.total === "number" ? order.total : null,
    itemCount: items.reduce((sum, item) => sum + (isRecord(item) && typeof item.quantity === "number" ? item.quantity : 0), 0),
  };
}

function normalizeOrderDetail(order: Record<string, unknown>): StoreCustomerOrderDetail {
  const base = normalizeOrder(order);
  const items = Array.isArray(order.items) ? order.items.filter(isRecord) : [];
  const address = isRecord(order.shipping_address) ? order.shipping_address : null;
  const shippingMethods = Array.isArray(order.shipping_methods) ? order.shipping_methods.filter(isRecord) : [];
  const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments.filter(isRecord) : [];
  const labels = fulfillments.flatMap((fulfillment) => Array.isArray(fulfillment.labels) ? fulfillment.labels.filter(isRecord) : []);
  const tracking = labels.find((label) => recordString(label, "tracking_number") || recordString(label, "tracking_url")) ?? null;

  return {
    ...base,
    items: items.map((item) => ({
      id: recordString(item, "id") ?? "",
      title: recordString(item, "product_title") ?? recordString(item, "title") ?? "Product",
      variantTitle: recordString(item, "variant_title") ?? "",
      thumbnail: recordString(item, "thumbnail"),
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      unitPrice: numberValue(item, "unit_price"),
      total: numberValue(item, "total"),
    })),
    subtotal: numberValue(order, "subtotal") ?? numberValue(order, "item_total"),
    shippingTotal: numberValue(order, "shipping_total"),
    taxTotal: numberValue(order, "tax_total"),
    discountTotal: numberValue(order, "discount_total"),
    shippingAddress: address ? {
      firstName: recordString(address, "first_name") ?? "",
      lastName: recordString(address, "last_name") ?? "",
      phone: recordString(address, "phone") ?? "",
      address1: recordString(address, "address_1") ?? "",
      address2: recordString(address, "address_2") ?? "",
      city: recordString(address, "city") ?? "",
      province: recordString(address, "province") ?? "",
      postalCode: recordString(address, "postal_code") ?? "",
      countryCode: recordString(address, "country_code") ?? "",
    } : null,
    shippingMethod: shippingMethods.length ? recordString(shippingMethods[0], "name") : null,
    fulfillmentState: resolveFulfillmentState(order, fulfillments),
    trackingNumber: tracking ? recordString(tracking, "tracking_number") : null,
    trackingUrl: tracking ? recordString(tracking, "tracking_url") : null,
  };
}

function resolveFulfillmentState(
  order: Record<string, unknown>,
  fulfillments: Record<string, unknown>[],
): StoreCustomerOrderDetail["fulfillmentState"] {
  if (recordString(order, "status") === "canceled" || fulfillments.some((item) => recordString(item, "canceled_at"))) return "cancelled";
  if (fulfillments.some((item) => recordString(item, "delivered_at"))) return "delivered";
  if (fulfillments.some((item) => recordString(item, "shipped_at"))) return "shipped";
  return fulfillments.length ? "preparing" : "received";
}

function numberValue(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] : null;
}

function normalizeCustomer(value: unknown): StoreCustomer | null {
  const customer = isRecord(value) && isRecord(value.customer) ? value.customer : null;
  const id = customer ? recordString(customer, "id") : null;
  const email = customer ? recordString(customer, "email") : null;
  if (!customer || !id || !email) return null;
  return {
    id,
    email,
    firstName: recordString(customer, "first_name") ?? "",
    lastName: recordString(customer, "last_name") ?? "",
    phone: recordString(customer, "phone") ?? "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordString(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : null;
}
