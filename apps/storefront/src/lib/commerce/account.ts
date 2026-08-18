import { asError, storeFetch } from "./http.js";
import type { HostedStoreRequest, StorefrontError } from "./types.js";

export type StoreCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type StoreCustomerOrder = {
  id: string;
  displayId: number | null;
  createdAt: string | null;
  status: string;
  currencyCode: string | null;
  total: number | null;
  itemCount: number;
};

export type CustomerAccountView = {
  customer: StoreCustomer;
  orders: StoreCustomerOrder[];
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
  options: HostedStoreRequest & { token: string },
): Promise<CustomerAccountView | StorefrontError> {
  const headers = { authorization: `Bearer ${options.token}` };
  const [customerResponse, ordersResponse] = await Promise.all([
    storeFetch({ ...options, path: "/store/customer/me", headers }),
    storeFetch({ ...options, path: "/store/customer/orders", headers, searchParams: { limit: 20 } }),
  ]);
  const customerData = await customerResponse.json().catch(() => null);
  if (!customerResponse.ok) return asError(customerResponse.status, customerData, "Your session has expired.");
  const ordersData = await ordersResponse.json().catch(() => null);
  if (!ordersResponse.ok) return asError(ordersResponse.status, ordersData, "Order history is unavailable.");

  const customer = isRecord(customerData) && isRecord(customerData.customer)
    ? customerData.customer
    : null;
  if (!customer || !recordString(customer, "id") || !recordString(customer, "email")) {
    return asError(502, customerData, "Invalid customer response.");
  }

  const rawOrders = isRecord(ordersData) && Array.isArray(ordersData.orders) ? ordersData.orders : [];
  return {
    customer: {
      id: recordString(customer, "id")!,
      email: recordString(customer, "email")!,
      firstName: recordString(customer, "first_name") ?? "",
      lastName: recordString(customer, "last_name") ?? "",
    },
    orders: rawOrders.filter(isRecord).map(normalizeOrder),
  };
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
    createdAt: recordString(order, "created_at"),
    status: recordString(order, "status") ?? "pending",
    currencyCode: recordString(order, "currency_code"),
    total: typeof order.total === "number" ? order.total : null,
    itemCount: items.reduce((sum, item) => sum + (isRecord(item) && typeof item.quantity === "number" ? item.quantity : 0), 0),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordString(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : null;
}
