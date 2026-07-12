import type {
  CustomerServiceError,
  MerchantCustomer,
  MerchantCustomerAddress,
  MerchantCustomerAddressInput,
  MerchantCustomerAddressResult,
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

/**
 * Multi-shop customer strategy (shared Medusa instance):
 * Email is globally unique in Medusa, so we cannot create a separate customer per shop.
 * Instead each shop owns a tenant customer-group; create either:
 * - creates a new customer and adds them to this shop's group, or
 * - finds an existing customer by email and links them into this shop's group.
 * "Already exists" only when that email is already in *this* shop's group.
 */
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
      (group: { metadata?: { tenant_id?: string }; id?: string }) =>
        group?.metadata?.tenant_id === tenantId,
    );
    if (existing?.id) return existing;
    const created = await fetcher(`${base}/admin/customer-groups`, {
      body: JSON.stringify({
        metadata: { tenant_id: tenantId },
        name: `Shop ${tenantId.slice(0, 8)}`,
      }),
      headers: headers(),
      method: "POST",
    }).catch(() => null);
    return created?.ok ? ((await created.json().catch(() => ({}))).customer_group ?? null) : null;
  }

  async function findByEmail(email: string): Promise<MerchantCustomer | null> {
    const search = new URLSearchParams({
      email,
      fields: "+groups,+addresses",
      limit: "1",
    });
    const response = await fetcher(`${base}/admin/customers?${search}`, {
      headers: headers(),
    }).catch(() => null);
    if (!response?.ok) return null;
    const data = await response.json().catch(() => ({}));
    const first = Array.isArray(data.customers) ? data.customers[0] : null;
    return first ? normalizeCustomer(first) : null;
  }

  async function attachToGroup(
    groupId: string,
    customerId: string,
  ): Promise<{ ok: true } | CustomerServiceError> {
    const attached = await fetcher(`${base}/admin/customer-groups/${groupId}/customers`, {
      body: JSON.stringify({ add: [customerId] }),
      headers: headers(),
      method: "POST",
    }).catch(() => null);
    if (!attached?.ok) return await mapError(attached);
    return { ok: true };
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
    if (!response?.ok) return await mapError(response);
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
        : await mapError(response);
    const customer = normalizeCustomer((await response.json().catch(() => ({}))).customer);
    return customer.groups.some((item) => item.id === group.id)
      ? { customer, ok: true }
      : { error: "customer_not_found", ok: false, status: 404 };
  }

  async function createCustomer(input: CustomerInput): Promise<MerchantCustomerResult> {
    const group = await tenantGroup(input.tenantId);
    if (!group) return unavailable();
    const email = input.email.trim().toLowerCase();

    // Prefer create; on global email uniqueness conflict, link into this shop instead.
    const response = await fetcher(`${base}/admin/customers`, {
      body: JSON.stringify(toPayload(input)),
      headers: headers(),
      method: "POST",
    }).catch(() => null);

    if (response?.ok) {
      const customer = normalizeCustomer((await response.json().catch(() => ({}))).customer);
      const linked = await attachToGroup(String(group.id), customer.id);
      if (!linked.ok) return linked;
      return {
        customer: {
          ...customer,
          groups: [{ id: String(group.id), name: String(group.name ?? "Customers") }],
        },
        ok: true,
      };
    }

    const createError = await mapError(response);
    if (createError.error !== "customer_email_conflict") return createError;

    const existing = await findByEmail(email);
    if (!existing) return createError;

    const alreadyInShop = existing.groups.some((item) => item.id === group.id);
    if (alreadyInShop) {
      return { error: "customer_email_conflict", ok: false, status: 409 };
    }

    const linked = await attachToGroup(String(group.id), existing.id);
    if (!linked.ok) return linked;

    // Optionally refresh profile fields when linking into a new shop.
    if (input.firstName || input.lastName || input.phone || input.companyName) {
      await fetcher(`${base}/admin/customers/${encodeURIComponent(existing.id)}`, {
        body: JSON.stringify(toPayload(input)),
        headers: headers(),
        method: "POST",
      }).catch(() => null);
    }

    const refreshed = await getCustomer({ customerId: existing.id, tenantId: input.tenantId });
    if (refreshed.ok) return refreshed;
    return {
      customer: {
        ...existing,
        groups: [
          ...existing.groups.filter((item) => item.id !== group.id),
          { id: String(group.id), name: String(group.name ?? "Customers") },
        ],
      },
      ok: true,
    };
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
      : await mapError(response);
  }
  async function listGroups(input: { tenantId: string }): Promise<MerchantCustomerGroupsResult> {
    const group = await tenantGroup(input.tenantId);
    return group
      ? { groups: [{ id: group.id, name: group.name ?? "Customers" }], ok: true }
      : unavailable();
  }

  async function createCustomerAddress(input: {
    address: MerchantCustomerAddressInput;
    customerId: string;
    tenantId: string;
  }): Promise<MerchantCustomerAddressResult> {
    const current = await getCustomer(input);
    if (!current.ok) return current;
    const response = await fetcher(
      `${base}/admin/customers/${encodeURIComponent(input.customerId)}/addresses`,
      {
        body: JSON.stringify(toAddressPayload(input.address)),
        headers: headers(),
        method: "POST",
      },
    ).catch(() => null);
    if (!response?.ok) return await mapAddressError(response);
    return getCustomer(input);
  }

  async function updateCustomerAddress(input: {
    address: MerchantCustomerAddressInput;
    addressId: string;
    customerId: string;
    tenantId: string;
  }): Promise<MerchantCustomerAddressResult> {
    const current = await getCustomer(input);
    if (!current.ok) return current;
    if (!current.customer.addresses.some((item) => item.id === input.addressId)) {
      return { error: "customer_address_not_found", ok: false, status: 404 };
    }
    const response = await fetcher(
      `${base}/admin/customers/${encodeURIComponent(input.customerId)}/addresses/${encodeURIComponent(input.addressId)}`,
      {
        body: JSON.stringify(toAddressPayload(input.address)),
        headers: headers(),
        method: "POST",
      },
    ).catch(() => null);
    if (!response?.ok) return await mapAddressError(response);
    return getCustomer(input);
  }

  async function deleteCustomerAddress(input: {
    addressId: string;
    customerId: string;
    tenantId: string;
  }): Promise<MerchantCustomerAddressResult> {
    const current = await getCustomer(input);
    if (!current.ok) return current;
    if (!current.customer.addresses.some((item) => item.id === input.addressId)) {
      return { error: "customer_address_not_found", ok: false, status: 404 };
    }
    const response = await fetcher(
      `${base}/admin/customers/${encodeURIComponent(input.customerId)}/addresses/${encodeURIComponent(input.addressId)}`,
      { headers: headers(), method: "DELETE" },
    ).catch(() => null);
    if (!response?.ok) return await mapAddressError(response);
    return getCustomer(input);
  }

  return {
    createCustomer,
    createCustomerAddress,
    deleteCustomerAddress,
    getCustomer,
    listCustomers,
    listGroups,
    updateCustomer,
    updateCustomerAddress,
  };
}

function toPayload(input: CustomerInput) {
  return {
    email: input.email.trim().toLowerCase(),
    metadata: { platform_tenant_id: input.tenantId },
    ...(input.companyName?.trim() ? { company_name: input.companyName.trim() } : {}),
    ...(input.firstName?.trim() ? { first_name: input.firstName.trim() } : {}),
    ...(input.lastName?.trim() ? { last_name: input.lastName.trim() } : {}),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
  };
}
function toAddressPayload(input: MerchantCustomerAddressInput) {
  return {
    ...(input.address1 !== undefined ? { address_1: input.address1?.trim() || null } : {}),
    ...(input.address2 !== undefined ? { address_2: input.address2?.trim() || null } : {}),
    ...(input.addressName !== undefined
      ? { address_name: input.addressName?.trim() || null }
      : {}),
    ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
    ...(input.company !== undefined ? { company: input.company?.trim() || null } : {}),
    ...(input.countryCode !== undefined
      ? { country_code: input.countryCode?.trim().toLowerCase() || null }
      : {}),
    ...(input.firstName !== undefined ? { first_name: input.firstName?.trim() || null } : {}),
    ...(input.isDefaultBilling !== undefined
      ? { is_default_billing: Boolean(input.isDefaultBilling) }
      : {}),
    ...(input.isDefaultShipping !== undefined
      ? { is_default_shipping: Boolean(input.isDefaultShipping) }
      : {}),
    ...(input.lastName !== undefined ? { last_name: input.lastName?.trim() || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
    ...(input.postalCode !== undefined ? { postal_code: input.postalCode?.trim() || null } : {}),
    ...(input.province !== undefined ? { province: input.province?.trim() || null } : {}),
  };
}

function normalizeAddress(value: any): MerchantCustomerAddress {
  return {
    address1: value?.address_1 ?? null,
    address2: value?.address_2 ?? null,
    addressName: value?.address_name ?? null,
    city: value?.city ?? null,
    company: value?.company ?? null,
    countryCode: value?.country_code ?? null,
    firstName: value?.first_name ?? null,
    id: String(value?.id ?? ""),
    isDefaultBilling: Boolean(value?.is_default_billing),
    isDefaultShipping: Boolean(value?.is_default_shipping),
    lastName: value?.last_name ?? null,
    phone: value?.phone ?? null,
    postalCode: value?.postal_code ?? null,
    province: value?.province ?? null,
  };
}

function normalizeCustomer(value: any): MerchantCustomer {
  return {
    addresses: (Array.isArray(value?.addresses) ? value.addresses : []).map(normalizeAddress),
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

async function mapError(response: Response | null): Promise<CustomerServiceError> {
  if (!response) return { error: "commerce_backend_unavailable", ok: false, status: 503 };
  if (response.status === 401)
    return { error: "commerce_credentials_invalid", ok: false, status: 401 };

  const body = await response
    .clone()
    .json()
    .catch(() => null);
  if (isEmailConflict(response.status, body)) {
    return { error: "customer_email_conflict", ok: false, status: 409 };
  }
  if (response.status === 400) {
    return { error: "invalid_customer", ok: false, status: 400 };
  }
  return { error: "commerce_backend_unavailable", ok: false, status: 503 };
}

async function mapAddressError(response: Response | null): Promise<CustomerServiceError> {
  if (!response) return { error: "commerce_backend_unavailable", ok: false, status: 503 };
  if (response.status === 401)
    return { error: "commerce_credentials_invalid", ok: false, status: 401 };
  if (response.status === 404)
    return { error: "customer_address_not_found", ok: false, status: 404 };
  if (response.status === 400)
    return { error: "invalid_customer_address", ok: false, status: 400 };
  return { error: "commerce_backend_unavailable", ok: false, status: 503 };
}

function isEmailConflict(status: number, body: unknown): boolean {
  if (status === 409 || status === 422) return true;
  const text = JSON.stringify(body ?? {}).toLowerCase();
  return (
    text.includes("email") &&
    (text.includes("exist") ||
      text.includes("unique") ||
      text.includes("duplicate") ||
      text.includes("already") ||
      text.includes("conflict"))
  );
}
