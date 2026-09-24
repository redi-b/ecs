import { z } from "zod";
import type { PlatformAppOptions } from "../../app.js";

type MerchantCustomerRouteDependencies = Pick<
  PlatformAppOptions,
  | "createMerchantCustomer"
  | "createMerchantCustomerAddress"
  | "deleteMerchantCustomerAddress"
  | "getMerchantCustomer"
  | "listMerchantCustomerGroups"
  | "listMerchantCustomers"
  | "updateMerchantCustomer"
  | "updateMerchantCustomerAddress"
>;

import {
  getOperationalCustomerEmail,
  normalizeOperationalPhone,
} from "../../modules/commerce/customer-identity.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const customerSchema = z.object({
  companyName: z.string().trim().max(120).nullish(),
  email: z.string().email(),
  firstName: z.string().trim().max(80).nullish(),
  lastName: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(40).nullish(),
});

const createCustomerSchema = customerSchema.extend({
  email: z.string().trim().email().nullish(),
  phone: z.string().trim().min(8).max(40),
});

const addressSchema = z.object({
  address1: z.string().trim().max(200).nullish(),
  address2: z.string().trim().max(200).nullish(),
  addressName: z.string().trim().max(80).nullish(),
  city: z.string().trim().max(120).nullish(),
  company: z.string().trim().max(120).nullish(),
  countryCode: z.string().trim().length(2).nullish(),
  firstName: z.string().trim().max(80).nullish(),
  isDefaultBilling: z.boolean().optional(),
  isDefaultShipping: z.boolean().optional(),
  lastName: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(40).nullish(),
  postalCode: z.string().trim().max(40).nullish(),
  province: z.string().trim().max(80).nullish(),
});

export function registerMerchantCustomerRoutes(
  app: MerchantRouteApp,
  options: MerchantCustomerRouteDependencies,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/customers", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantCustomers)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.listMerchantCustomers({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 100_000),
      query: context.req.query("q")?.trim() || undefined,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });
  app.get("/platform/merchant/customers/:customerId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.getMerchantCustomer)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.getMerchantCustomer({
      customerId: context.req.param("customerId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });
  app.post("/platform/merchant/customers", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["update"] });
    if (!merchant.ok) return merchant.response;
    const parsed = createCustomerSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_customer" }, 400);
    if (!options.createMerchantCustomer)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const phone = normalizeOperationalPhone(parsed.data.phone);
    if (!phone) return context.json({ error: "invalid_customer" }, 400);
    const email = getOperationalCustomerEmail({
      email: parsed.data.email,
      phone,
      tenantId: merchant.result.context.tenantId,
    });
    if (!email) return context.json({ error: "invalid_customer" }, 400);
    const result = await options.createMerchantCustomer({
      ...parsed.data,
      email,
      phone: `+${phone}`,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, result.status);
  });
  app.post("/platform/merchant/customers/:customerId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["update"] });
    if (!merchant.ok) return merchant.response;
    const parsed = createCustomerSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_customer" }, 400);
    if (!options.updateMerchantCustomer)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const phone = normalizeOperationalPhone(parsed.data.phone);
    if (!phone) return context.json({ error: "invalid_customer" }, 400);
    const email = getOperationalCustomerEmail({
      email: parsed.data.email,
      phone,
      tenantId: merchant.result.context.tenantId,
    });
    if (!email) return context.json({ error: "invalid_customer" }, 400);
    const result = await options.updateMerchantCustomer({
      ...parsed.data,
      customerId: context.req.param("customerId"),
      email,
      phone: `+${phone}`,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });
  app.get("/platform/merchant/customer-groups", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantCustomerGroups)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.listMerchantCustomerGroups({
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/customers/:customerId/addresses", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["update"] });
    if (!merchant.ok) return merchant.response;
    const parsed = addressSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_customer_address" }, 400);
    if (!options.createMerchantCustomerAddress)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.createMerchantCustomerAddress({
      address: parsed.data,
      customerId: context.req.param("customerId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/customers/:customerId/addresses/:addressId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["update"] });
    if (!merchant.ok) return merchant.response;
    const parsed = addressSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_customer_address" }, 400);
    if (!options.updateMerchantCustomerAddress)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.updateMerchantCustomerAddress({
      address: parsed.data,
      addressId: context.req.param("addressId"),
      customerId: context.req.param("customerId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.delete("/platform/merchant/customers/:customerId/addresses/:addressId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { customers: ["update"] });
    if (!merchant.ok) return merchant.response;
    if (!options.deleteMerchantCustomerAddress)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.deleteMerchantCustomerAddress({
      addressId: context.req.param("addressId"),
      customerId: context.req.param("customerId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });
}
