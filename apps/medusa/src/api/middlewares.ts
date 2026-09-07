import { defineMiddlewares, validateAndTransformQuery } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { listProductQueryConfig } from "@medusajs/medusa/api/admin/products/query-config";
import { productMediaQuerySchema } from "../lib/product-media-query";
import {
  PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY,
  productOptionValuePresentationsAdditionalDataSchema,
} from "../lib/product-option-value-presentation-contract";
import { tenantPromotionQuerySchema } from "../lib/tenant-promotion-query";
import { tenantTaxonomyQuerySchema } from "../lib/tenant-taxonomy-query";

const additionalDataValidator = {
  [PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY]:
    productOptionValuePresentationsAdditionalDataSchema.optional(),
};

export default defineMiddlewares({
  routes: [
    {
      method: "GET",
      matcher: "/admin/platform-promotions",
      middlewares: [validateAndTransformQuery(tenantPromotionQuerySchema, {})],
    },
    {
      method: "GET",
      matcher: "/admin/platform-customer-group",
      middlewares: [
        validateAndTransformQuery(z.object({ tenant_id: z.string().trim().min(1).max(255) }), {}),
      ],
    },
    {
      method: "GET",
      matcher: "/admin/platform-products",
      middlewares: [validateAndTransformQuery(productMediaQuerySchema, listProductQueryConfig)],
    },
    {
      method: "GET",
      matcher: "/admin/platform-taxonomy",
      middlewares: [validateAndTransformQuery(tenantTaxonomyQuerySchema, {})],
    },
    {
      method: "POST",
      matcher: "/admin/products",
      additionalDataValidator,
    },
    {
      method: "POST",
      matcher: "/admin/products/:id",
      additionalDataValidator,
    },
  ],
});
