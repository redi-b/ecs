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
}
