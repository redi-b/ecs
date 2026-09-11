import { z } from "zod";

import type { PlatformAppOptions } from "../../app.js";
import {
  getOperationalCustomerEmail,
  normalizeOperationalPhone,
} from "../../commerce/customer-identity.js";
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
  customerEmail: z.string().trim().email().nullish(),
  customerFirstName: z.string().trim().max(80).nullish(),
  customerId: z.string().min(1).nullish(),
  customerLastName: z.string().trim().max(80).nullish(),
  customerPhone: z.string().trim().min(8).max(40).nullish(),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive().max(1000),
        unitPrice: z.number().nonnegative().finite().max(100_000_000).nullish(),
        variantId: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
  note: z.string().trim().max(500).nullish(),
  discount: z
    .object({
      type: z.enum(["fixed", "percentage"]),
      value: z.number().positive().finite().max(100_000_000),
    })
    .nullish(),
  adjustmentReason: z.string().trim().min(3).max(240).nullish(),
  shippingAddress: addressSchema.nullish(),
});

export function registerMerchantManualOrderRoutes(
  app: MerchantRouteApp,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.post("/platform/merchant/manual-orders", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { orders: ["create"] });
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

    const hasAdjustment = Boolean(
      parsed.data.discount || parsed.data.items.some((item) => item.unitPrice != null),
    );
    if (hasAdjustment && !parsed.data.adjustmentReason) {
      return context.json({ error: "manual_order_adjustment_reason_required" }, 400);
    }
    if (parsed.data.discount?.type === "percentage" && parsed.data.discount.value > 100) {
      return context.json({ error: "invalid_manual_order_discount" }, 400);
    }

    const normalizedPhone = normalizeOperationalPhone(
      parsed.data.customerPhone ?? shippingAddress?.phone,
    );
    if (!parsed.data.customerId && !normalizedPhone) {
      return context.json({ error: "invalid_manual_order" }, 400);
    }
    const customerEmail = getOperationalCustomerEmail({
      email: parsed.data.customerEmail,
      phone: normalizedPhone,
      tenantId: merchant.result.context.tenantId,
    });
    if (!customerEmail) return context.json({ error: "invalid_manual_order" }, 400);

    let customerId = parsed.data.customerId ?? null;
    if (!customerId && options.ensureMerchantCustomer) {
      const ensured = await options.ensureMerchantCustomer({
        email: customerEmail,
        firstName: parsed.data.customerFirstName ?? shippingAddress?.firstName ?? null,
        lastName: parsed.data.customerLastName ?? shippingAddress?.lastName ?? null,
        phone: normalizedPhone ? `+${normalizedPhone}` : null,
        tenantId: merchant.result.context.tenantId,
      });
      if (ensured.ok) {
        customerId = ensured.customer.id;
      }
      // If ensure fails, still attempt the order with email only.
    }

    const result = await options.createMerchantManualOrder({
      customerEmail,
      customerId,
      items: parsed.data.items,
      discount: parsed.data.discount ?? null,
      adjustmentReason: parsed.data.adjustmentReason ?? null,
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
