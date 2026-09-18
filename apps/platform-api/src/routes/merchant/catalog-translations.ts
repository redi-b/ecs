import {
  catalogTranslationQueueQuerySchema,
  catalogTranslationResourceQuerySchema,
  catalogTranslationUpdateSchema,
} from "@ecs/contracts";
import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

export function registerMerchantCatalogTranslationRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/storefront/translations/catalog/readiness", async (context) => {
    const parsed = catalogTranslationQueueQuerySchema.safeParse(context.req.query());
    if (!parsed.success) return context.json({ error: "invalid_catalog_translation" }, 400);
    const merchant = await helpers.getAuthorizedMerchantContext(
      context,
      translationPermission(parsed.data.resourceType, "read"),
    );
    if (!merchant.ok) return merchant.response;
    const commerce = helpers.getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.listMerchantCatalogTranslationReadiness) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const result = await options.listMerchantCatalogTranslationReadiness({
      ...parsed.data,
      salesChannelId: commerce.context.medusaSalesChannelId,
      shippingOptionId: merchant.result.context.medusaShippingOptionId,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result.queue)
      : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/merchant/storefront/translations/catalog", async (context) => {
    const parsed = catalogTranslationResourceQuerySchema.safeParse(context.req.query());
    if (!parsed.success) {
      return context.json({ error: "invalid_catalog_translation" }, 400);
    }
    const merchant = await helpers.getAuthorizedMerchantContext(
      context,
      translationPermission(parsed.data.resourceType, "read"),
    );
    if (!merchant.ok) return merchant.response;
    const commerce = helpers.getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.getMerchantCatalogTranslation) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    if (parsed.data.resourceType === "shipping_option" && !merchant.result.context.medusaShippingOptionId) {
      return context.json({ error: "commerce_shipping_option_missing" }, 503);
    }
    const result = await options.getMerchantCatalogTranslation({
      ...parsed.data,
      resourceId: parsed.data.resourceType === "shipping_option"
        ? merchant.result.context.medusaShippingOptionId!
        : parsed.data.resourceId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      shippingOptionId: merchant.result.context.medusaShippingOptionId,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json({ resource: result.resource })
      : context.json({ error: result.error }, result.status);
  });

  app.put("/platform/merchant/storefront/translations/catalog", async (context) => {
    const parsed = catalogTranslationUpdateSchema.safeParse(await getJsonBody(context.req.raw));
    if (!parsed.success) {
      return context.json({ error: "invalid_catalog_translation" }, 400);
    }
    const merchant = await helpers.getAuthorizedMerchantContext(
      context,
      translationPermission(parsed.data.resourceType, "update"),
    );
    if (!merchant.ok) return merchant.response;
    const commerce = helpers.getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.updateMerchantCatalogTranslation) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    if (parsed.data.resourceType === "shipping_option" && !merchant.result.context.medusaShippingOptionId) {
      return context.json({ error: "commerce_shipping_option_missing" }, 503);
    }
    const result = await options.updateMerchantCatalogTranslation({
      ...parsed.data,
      resourceId: parsed.data.resourceType === "shipping_option"
        ? merchant.result.context.medusaShippingOptionId!
        : parsed.data.resourceId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      shippingOptionId: merchant.result.context.medusaShippingOptionId,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json({ resource: result.resource })
      : context.json({ error: result.error }, result.status);
  });
}

export function translationPermission(
  resourceType: "product" | "product_variant" | "product_option" | "product_option_value" | "product_category" | "product_collection" | "shipping_option",
  access: "read" | "update",
) {
  return resourceType === "shipping_option"
    ? { settings: [access === "read" ? "read" : "manage"] as ("read" | "manage")[] }
    : { products: [access] as ("read" | "update")[] };
}
