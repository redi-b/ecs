import type {
  CustomerServiceError,
  MerchantCustomer,
  MerchantCustomerGroupsResult,
  MerchantCustomerResult,
  MerchantCustomersResult,
} from "../../types/index.js";
import { getAdminHeaders } from "./product/medusa-http.js";

type Options = {
  adminApiToken?: string | undefined;
  medusaInternalUrl: string;
  fetcher?: typeof fetch;
};
type CustomerInput = {
  companyName?: string | null | undefined;
  email: string;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  phone?: string | null | undefined;
  tenantId: string;
};

export function createMedusaCustomerService(options: Options) {
  const fetcher = options.fetcher ?? fetch;
  const base = options.medusaInternalUrl.replace(/\/$/, "");
  const headers = () => getAdminHeaders(options.adminApiToken ?? "");
  const unavailable = (): CustomerServiceError =>
    !options.adminApiToken?.trim()
      ? { error: "commerce_credentials_invalid", ok: false, status: 401 }
      : { error: "commerce_backend_unavailable", ok: false, status: 503 };

  async function tenantGroup(tenantId: string) {
    const response = await fetcher(`${base}/admin/customer-groups?limit=100`, {
      headers: headers(),
    }).catch(() => null);
    if (!response?.ok) return null;
    const data = await response.json().catch(() => ({}));
    const existing = (Array.isArray(data.customer_groups) ? data.customer_groups : []).find(
      (group: any) => group?.metadata?.tenant_id === tenantId,
    );
    if (existing?.id) return existing;
    const created = await fetcher(`${base}/admin/customer-groups`, {
      body: JSON.stringify({ metadata: { tenant_id: tenantId }, name: `Tenant ${tenantId}` }),
      headers: headers(),
      method: "POST",
    }).catch(() => null);
    return created?.ok ? ((await created.json().catch(() => ({}))).customer_group ?? null) : null;
  }

  async function listCustomers(input: {
    limit: number;
    offset: number;
    query?: string | undefined;
    tenantId: string;
  }): Promise<MerchantCustomersResult> {
    const group = await tenantGroup(input.tenantId);
    if (!group) return unavailable();
    const search = new URLSearchParams({
      fields: "+groups,+addresses",
      groups: group.id,
      limit: String(input.limit),
      offset: String(input.offset),
    });
    if (input.query) search.set("q", input.query);
    const response = await fetcher(`${base}/admin/customers?${search}`, {
      headers: headers(),
    }).catch(() => null);
    if (!response?.ok) return mapError(response);
    const data = await response.json().catch(() => ({}));
    const customers = (Array.isArray(data.customers) ? data.customers : []).map(normalizeCustomer);
    return {
      count: Number(data.count ?? customers.length),
      customers,
      limit: input.limit,
      offset: input.offset,
      ok: true,
    };
  }

  async function getCustomer(input: {
    customerId: string;
    tenantId: string;
  }): Promise<MerchantCustomerResult> {
    const group = await tenantGroup(input.tenantId);
    if (!group) return unavailable();
    const response = await fetcher(
      `${base}/admin/customers/${encodeURIComponent(input.customerId)}?fields=+groups,+addresses`,
      { headers: headers() },
    ).catch(() => null);
    if (!response?.ok)
      return response?.status === 404
        ? { error: "customer_not_found", ok: false, status: 404 }
        : mapError(response);
    const customer = normalizeCustomer((await response.json().catch(() => ({}))).customer);
    return customer.groups.some((item) => item.id === group.id)
      ? { customer, ok: true }
      : { error: "customer_not_found", ok: false, status: 404 };
  }

  async function createCustomer(input: CustomerInput): Promise<MerchantCustomerResult> {
    const group = await tenantGroup(input.tenantId);
    if (!group) return unavailable();
    const response = await fetcher(`${base}/admin/customers`, {
      body: JSON.stringify(toPayload(input)),
      headers: headers(),
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) return mapError(response);
    const customer = normalizeCustomer((await response.json().catch(() => ({}))).customer);
    // Medusa AdminBatchLink: { add, remove } — not customer_ids.
    const attached = await fetcher(`${base}/admin/customer-groups/${group.id}/customers`, {
      body: JSON.stringify({ add: [customer.id] }),
      headers: headers(),
      method: "POST",
    }).catch(() => null);
    if (!attached?.ok) return unavailable();
    return { customer: { ...customer, groups: [{ id: group.id, name: group.name }] }, ok: true };
  }

  async function updateCustomer(
    input: CustomerInput & { customerId: string },
  ): Promise<MerchantCustomerResult> {
    const current = await getCustomer(input);
    if (!current.ok) return current;
    const response = await fetcher(
      `${base}/admin/customers/${encodeURIComponent(input.customerId)}`,
      { body: JSON.stringify(toPayload(input)), headers: headers(), method: "POST" },
    ).catch(() => null);
    return response?.ok
      ? {
          customer: normalizeCustomer((await response.json().catch(() => ({}))).customer),
          ok: true,
        }
      : mapError(response);
  }
  async function listGroups(input: { tenantId: string }): Promise<MerchantCustomerGroupsResult> {
    const group = await tenantGroup(input.tenantId);
    return group ? { groups: [{ id: group.id, name: group.name }], ok: true } : unavailable();
  }
  return { createCustomer, getCustomer, listCustomers, listGroups, updateCustomer };
}

function toPayload(input: CustomerInput) {
  // Omit empty optionals — Medusa rejects unexpected nulls on some fields.
  return {
    email: input.email.trim().toLowerCase(),
    ...(input.companyName?.trim() ? { company_name: input.companyName.trim() } : {}),
    ...(input.firstName?.trim() ? { first_name: input.firstName.trim() } : {}),
    ...(input.lastName?.trim() ? { last_name: input.lastName.trim() } : {}),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
  };
}
function normalizeCustomer(value: any): MerchantCustomer {
  return {
    addresses: (Array.isArray(value?.addresses) ? value.addresses : []).map((a: any) => ({
      address1: a.address_1 ?? null,
      city: a.city ?? null,
      countryCode: a.country_code ?? null,
      id: String(a.id),
      isDefaultBilling: Boolean(a.is_default_billing),
      isDefaultShipping: Boolean(a.is_default_shipping),
    })),
    companyName: value?.company_name ?? null,
    createdAt: value?.created_at ?? new Date(0).toISOString(),
    email: String(value?.email ?? ""),
    firstName: value?.first_name ?? null,
    groups: (Array.isArray(value?.groups) ? value.groups : []).map((g: any) => ({
      id: String(g.id),
      name: String(g.name ?? "Group"),
    })),
    id: String(value?.id ?? ""),
    lastName: value?.last_name ?? null,
    phone: value?.phone ?? null,
    updatedAt: value?.updated_at ?? value?.created_at ?? new Date(0).toISOString(),
  };
}
function mapError(response: Response | null): CustomerServiceError {
  if (response?.status === 401)
    return { error: "commerce_credentials_invalid", ok: false, status: 401 };
  if (response?.status === 409 || response?.status === 422)
    return { error: "customer_email_conflict", ok: false, status: 409 };
  return { error: "commerce_backend_unavailable", ok: false, status: 503 };
}
