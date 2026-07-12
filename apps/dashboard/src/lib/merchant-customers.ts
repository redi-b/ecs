import { z } from "zod";
import { type PlatformRequestContext, platformFetch } from "@/lib/platform-api/client";

const groupSchema = z.object({ id: z.string(), name: z.string() });
export const customerAddressSchema = z.object({
  address1: z.string().nullable(),
  address2: z.string().nullable().optional().default(null),
  addressName: z.string().nullable().optional().default(null),
  city: z.string().nullable(),
  company: z.string().nullable().optional().default(null),
  countryCode: z.string().nullable(),
  firstName: z.string().nullable().optional().default(null),
  id: z.string(),
  isDefaultBilling: z.boolean(),
  isDefaultShipping: z.boolean(),
  lastName: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  postalCode: z.string().nullable().optional().default(null),
  province: z.string().nullable().optional().default(null),
});
export const customerSchema = z.object({
  addresses: z.array(customerAddressSchema),
  companyName: z.string().nullable(),
  createdAt: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  groups: z.array(groupSchema),
  id: z.string(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  updatedAt: z.string(),
});
export type MerchantCustomer = z.infer<typeof customerSchema>;
export type MerchantCustomerAddress = z.infer<typeof customerAddressSchema>;

export async function getMerchantCustomers(
  context: PlatformRequestContext & { limit?: number; offset?: number; query?: string },
) {
  const search = new URLSearchParams({
    limit: String(context.limit ?? 20),
    offset: String(context.offset ?? 0),
  });
  if (context.query) search.set("q", context.query);
  const response = await platformFetch(`/platform/merchant/customers?${search}`, context);
  const data = await response.json().catch(() => null);
  const parsed = z
    .object({
      count: z.number(),
      customers: z.array(customerSchema),
      limit: z.number(),
      offset: z.number(),
    })
    .safeParse(data);
  return response.ok && parsed.success
    ? { customers: parsed.data, ok: true as const }
    : { message: getError(data), ok: false as const, status: response.status };
}
export async function getMerchantCustomer(context: PlatformRequestContext, customerId: string) {
  const response = await platformFetch(
    `/platform/merchant/customers/${encodeURIComponent(customerId)}`,
    context,
  );
  const data = await response.json().catch(() => null);
  const parsed = z.object({ customer: customerSchema }).safeParse(data);
  return response.ok && parsed.success
    ? { customer: parsed.data.customer, ok: true as const }
    : { message: getError(data), ok: false as const, status: response.status };
}
function getError(data: unknown) {
  return z.object({ error: z.string() }).safeParse(data).data?.error ?? "customer_request_failed";
}
