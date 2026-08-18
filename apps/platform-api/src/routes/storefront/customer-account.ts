import { z } from "zod";

import { getForwardHeaders } from "../shared.js";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

const registrationSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(50),
});

type CustomerAccountRequest = {
  ensureTenantCustomer?: ((input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    tenantId: string;
  }) => Promise<unknown>) | undefined;
  medusaInternalUrl: string;
  medusaPublishableKey: string;
  medusaSalesChannelId: string | null;
  medusaStoreFetch: typeof fetch;
  request: Request;
  tenantId: string;
};

export async function handleCustomerAccountRequest(
  input: CustomerAccountRequest,
): Promise<Response | null> {
  const path = new URL(input.request.url).pathname;

  if (input.request.method === "POST" && path === "/store/customer-auth/login") {
    const parsed = credentialsSchema.safeParse(await readJson(input.request));
    if (!parsed.success) return error("invalid_customer_credentials", 422);

    const response = await medusaRequest(input, "/auth/customer/emailpass", {
      body: parsed.data,
      method: "POST",
    });
    const sanitized = await sanitizeAuthResponse(response, "customer_login_failed");
    await projectAuthenticatedCustomer(input, sanitized);
    return sanitized;
  }

  if (input.request.method === "POST" && path === "/store/customer-auth/register") {
    const parsed = registrationSchema.safeParse(await readJson(input.request));
    if (!parsed.success) return error("invalid_customer_registration", 422);

    const registration = await medusaRequest(input, "/auth/customer/emailpass/register", {
      body: { email: parsed.data.email, password: parsed.data.password },
      method: "POST",
    });
    const registrationData = await readResponseJson(registration);
    const registrationToken = stringValue(registrationData, "token");
    if (!registration.ok || !registrationToken) {
      return errorFromMedusa(registration, registrationData, "customer_registration_failed");
    }

    const created = await medusaRequest(input, "/store/customers", {
      authorization: registrationToken,
      body: {
        email: parsed.data.email,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
      method: "POST",
    });
    const createdData = await readResponseJson(created);
    if (!created.ok) {
      return errorFromMedusa(created, createdData, "customer_registration_failed");
    }

    const login = await medusaRequest(input, "/auth/customer/emailpass", {
      body: { email: parsed.data.email, password: parsed.data.password },
      method: "POST",
    });
    const sanitized = await sanitizeAuthResponse(login, "customer_login_failed");
    await projectAuthenticatedCustomer(input, sanitized, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
    return sanitized;
  }

  if (input.request.method === "GET" && path === "/store/customer/me") {
    const token = bearerToken(input.request);
    if (!token) return error("customer_auth_required", 401);
    return proxyCustomerResponse(
      await medusaRequest(input, "/store/customers/me", { authorization: token }),
    );
  }

  if (input.request.method === "POST" && path === "/store/customer/profile") {
    const token = bearerToken(input.request);
    if (!token) return error("customer_auth_required", 401);
    const parsed = profileSchema.safeParse(await readJson(input.request));
    if (!parsed.success) return error("invalid_customer_profile", 422);
    return proxyCustomerResponse(await medusaRequest(input, "/store/customers/me", {
      authorization: token,
      body: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone || null,
      },
      method: "POST",
    }));
  }

  if (input.request.method === "GET" && path === "/store/customer/orders") {
    const token = bearerToken(input.request);
    if (!token) return error("customer_auth_required", 401);

    const incoming = new URL(input.request.url);
    const requestedLimit = Number(clampPageValue(incoming.searchParams.get("limit"), 20, 50));
    const requestedOffset = Number(clampPageValue(incoming.searchParams.get("offset"), 0, 10_000));
    const loaded = await loadCustomerOrders(input, token);
    if (!loaded.ok) return loaded.response;
    const orders = loaded.orders;
    const scoped = input.medusaSalesChannelId
      ? orders.filter((order) => order.sales_channel_id === input.medusaSalesChannelId)
      : [];

    return Response.json({
      orders: scoped.slice(requestedOffset, requestedOffset + requestedLimit),
      count: scoped.length,
      limit: requestedLimit,
      offset: requestedOffset,
    });
  }

  const orderMatch = path.match(/^\/store\/customer\/orders\/([A-Za-z0-9_-]+)$/);
  if (input.request.method === "GET" && orderMatch) {
    const token = bearerToken(input.request);
    if (!token) return error("customer_auth_required", 401);
    const orderId = orderMatch[1]!;
    const medusaPath = new URL(`/store/orders/${encodeURIComponent(orderId)}`, normalizeBaseUrl(input.medusaInternalUrl));
    medusaPath.searchParams.set(
      "fields",
      "id,display_id,custom_display_id,status,created_at,currency_code,total,subtotal,item_total,shipping_total,tax_total,discount_total,sales_channel_id,*items,*items.variant,*shipping_address,*shipping_methods,*fulfillments,*fulfillments.labels",
    );
    const response = await medusaRequest(input, `${medusaPath.pathname}${medusaPath.search}`, {
      authorization: token,
    });
    const data = await readResponseJson(response);
    if (!response.ok) return errorFromMedusa(response, data, "customer_order_not_found");
    const order = isRecord(data.order) ? data.order : null;
    if (!order || !input.medusaSalesChannelId || order.sales_channel_id !== input.medusaSalesChannelId) {
      return error("customer_order_not_found", 404);
    }
    return Response.json({ order });
  }

  return null;
}

async function projectAuthenticatedCustomer(
  input: CustomerAccountRequest,
  response: Response,
  known?: { email: string; firstName?: string; lastName?: string },
) {
  if (!input.ensureTenantCustomer || !response.ok) return;
  const data = await response.clone().json().catch(() => ({}));
  const token = isRecord(data) ? stringValue(data, "token") : null;
  if (!token) return;
  let customer = known;
  if (!customer) {
    const current = await medusaRequest(input, "/store/customers/me", { authorization: token });
    const currentData = await readResponseJson(current);
    const raw = isRecord(currentData.customer) ? currentData.customer : null;
    const email = raw ? stringValue(raw, "email") : null;
    if (!current.ok || !email) return;
    const firstName = stringValue(raw!, "first_name");
    const lastName = stringValue(raw!, "last_name");
    customer = {
      email,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    };
  }
  if (!customer) return;
  await input.ensureTenantCustomer({
    email: customer.email,
    ...(customer.firstName ? { firstName: customer.firstName } : {}),
    ...(customer.lastName ? { lastName: customer.lastName } : {}),
    tenantId: input.tenantId,
  }).catch(() => undefined);
}

async function loadCustomerOrders(input: CustomerAccountRequest, token: string): Promise<
  | { ok: true; orders: Record<string, unknown>[] }
  | { ok: false; response: Response }
> {
  const orders: Record<string, unknown>[] = [];
  const pageSize = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total && offset < 2_000) {
    const medusaPath = new URL("/store/orders", normalizeBaseUrl(input.medusaInternalUrl));
    medusaPath.searchParams.set("limit", String(pageSize));
    medusaPath.searchParams.set("offset", String(offset));
    medusaPath.searchParams.set(
      "fields",
      "id,display_id,custom_display_id,status,created_at,currency_code,total,subtotal,item_total,shipping_total,discount_total,sales_channel_id,*items,*items.variant,*shipping_address",
    );
    const response = await medusaRequest(input, `${medusaPath.pathname}${medusaPath.search}`, {
      authorization: token,
    });
    const data = await readResponseJson(response);
    if (!response.ok) return { ok: false, response: errorFromMedusa(response, data, "customer_orders_unavailable") };
    const page = Array.isArray(data.orders) ? data.orders.filter(isRecord) : [];
    orders.push(...page);
    total = typeof data.count === "number" ? data.count : orders.length;
    if (!page.length) break;
    offset += page.length;
  }
  return { ok: true, orders };
}

async function medusaRequest(
  input: CustomerAccountRequest,
  path: string,
  options: { authorization?: string; body?: unknown; method?: string } = {},
) {
  const headers = getForwardHeaders(input.request, input.medusaPublishableKey);
  headers.set("accept", "application/json");
  if (options.authorization) headers.set("authorization", `Bearer ${options.authorization}`);
  if (options.body !== undefined) headers.set("content-type", "application/json");

  const init: RequestInit = {
    headers,
    method: options.method ?? "GET",
    redirect: "manual",
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  return input.medusaStoreFetch(
    new Request(new URL(path.replace(/^\//, ""), normalizeBaseUrl(input.medusaInternalUrl)), init),
  );
}

async function sanitizeAuthResponse(response: Response, fallback: string) {
  const data = await readResponseJson(response);
  const token = stringValue(data, "token");
  if (!response.ok || !token) return errorFromMedusa(response, data, fallback);
  return Response.json({ token });
}

async function proxyCustomerResponse(response: Response) {
  const data = await readResponseJson(response);
  if (!response.ok) return errorFromMedusa(response, data, "customer_session_invalid");
  return Response.json(data);
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization")?.trim() ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : null;
}

async function readJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}

async function readResponseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch { return {}; }
}

function errorFromMedusa(response: Response, data: Record<string, unknown>, fallback: string) {
  const raw = `${stringValue(data, "message") ?? ""} ${stringValue(data, "error") ?? ""}`;
  const safe = response.status === 401
    ? "invalid_customer_credentials"
    : /already|exist|duplicate/i.test(raw)
      ? "customer_account_exists"
      : fallback;
  return error(safe, response.status >= 400 && response.status < 500 ? response.status : 502);
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function stringValue(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" && value[key].trim() ? value[key].trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeBaseUrl(value: string) { return value.endsWith("/") ? value : `${value}/`; }

function clampPageValue(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return String(Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback);
}
