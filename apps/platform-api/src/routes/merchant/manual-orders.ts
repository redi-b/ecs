import { z } from "zod";

import type { PlatformAppOptions } from "../../app.js";
import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const addressSchema = z.object({
  address1: z.string().trim().max(200).nullish(),
  address2: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(120).nullish(),
  countryCode: z.string().trim().length(2).nullish(),
  firstName: z.string().trim().max(80).nullish(),
  lastName: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(40).nullish(),
  postalCode: z.string().trim().max(40).nullish(),
  province: z.string().trim().max(80).nullish(),
});

const createSchema = z.object({
  customerEmail: z.string().email(),
  customerFirstName: z.string().trim().max(80).nullish(),
  customerId: z.string().min(1).nullish(),
  customerLastName: z.string().trim().max(80).nullish(),
  customerPhone: z.string().trim().max(40).nullish(),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive().max(1000),
        variantId: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
  note: z.string().trim().max(500).nullish(),
  shippingAddress: addressSchema.nullish(),
});

export function registerMerchantManualOrderRoutes(
  app: MerchantRouteApp,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.post("/platform/merchant/manual-orders", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;

    const parsed = createSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_manual_order" }, 400);

    if (!options.createMerchantManualOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const commerce = helpers.getResolvedCommerce(merchant.result.context, {
      requireRegion: true,
    });
    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const shippingAddress = parsed.data.shippingAddress
      ? {
          ...parsed.data.shippingAddress,
          // Ethiopia is the only supported shipping country for now.
          countryCode: "et",
        }
      : null;

    let customerId = parsed.data.customerId ?? null;
    if (!customerId && options.ensureMerchantCustomer) {
      const ensured = await options.ensureMerchantCustomer({
        email: parsed.data.customerEmail,
        firstName:
          parsed.data.customerFirstName ?? shippingAddress?.firstName ?? null,
        lastName: parsed.data.customerLastName ?? shippingAddress?.lastName ?? null,
        phone: parsed.data.customerPhone ?? shippingAddress?.phone ?? null,
        tenantId: merchant.result.context.tenantId,
      });
      if (ensured.ok) {
        customerId = ensured.customer.id;
      }
      // If ensure fails, still attempt the order with email only.
    }

    const result = await options.createMerchantManualOrder({
      customerEmail: parsed.data.customerEmail,
      customerId,
      items: parsed.data.items,
      note: parsed.data.note ?? null,
      regionId: commerce.context.medusaRegionId!,
      salesChannelId: commerce.context.medusaSalesChannelId,
      shippingAddress,
      shippingOptionId: merchant.result.context.medusaShippingOptionId,
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });

    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, result.status);
  });
}
