import { z } from "zod";
import type { PlatformAppOptions } from "../../app.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const customerSchema = z.object({
  companyName: z.string().trim().max(120).nullish(),
  email: z.string().email(),
  firstName: z.string().trim().max(80).nullish(),
  lastName: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(40).nullish(),
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
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/customers", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
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
    const merchant = await helpers.getAuthorizedMerchantContext(context);
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
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const parsed = customerSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_customer" }, 400);
    if (!options.createMerchantCustomer)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.createMerchantCustomer({
      ...parsed.data,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, result.status);
  });
  app.post("/platform/merchant/customers/:customerId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const parsed = customerSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_customer" }, 400);
    if (!options.updateMerchantCustomer)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.updateMerchantCustomer({
      ...parsed.data,
      customerId: context.req.param("customerId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });
  app.get("/platform/merchant/customer-groups", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantCustomerGroups)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.listMerchantCustomerGroups({
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/customers/:customerId/addresses", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
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

  app.post(
    "/platform/merchant/customers/:customerId/addresses/:addressId",
    async (context) => {
      const merchant = await helpers.getAuthorizedMerchantContext(context);
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
      return result.ok
        ? context.json(result)
        : context.json({ error: result.error }, result.status);
    },
  );

  app.delete(
    "/platform/merchant/customers/:customerId/addresses/:addressId",
    async (context) => {
      const merchant = await helpers.getAuthorizedMerchantContext(context);
      if (!merchant.ok) return merchant.response;
      if (!options.deleteMerchantCustomerAddress)
        return context.json({ error: "commerce_backend_unavailable" }, 503);
      const result = await options.deleteMerchantCustomerAddress({
        addressId: context.req.param("addressId"),
        customerId: context.req.param("customerId"),
        tenantId: merchant.result.context.tenantId,
      });
      return result.ok
        ? context.json(result)
        : context.json({ error: result.error }, result.status);
    },
  );
}
