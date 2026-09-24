import {
  defineMiddlewares,
  maybeApplyLinkFilter,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { listProductQueryConfig } from "@medusajs/medusa/api/admin/products/query-config";
import { manualOrderAdjustmentSchema } from "../lib/manual-order-adjustment";
import { productMediaQuerySchema } from "../lib/product-media-query";
import { platformProductUpdateSchema } from "../lib/platform-product-update";
import {
  adminProductSearchQuerySchema,
  productSearchQuerySchema,
} from "../lib/product-search-query";
import {
  PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY,
  productOptionValuePresentationsAdditionalDataSchema,
} from "../lib/product-option-value-presentation-contract";
import { tenantPromotionQuerySchema } from "../lib/tenant-promotion-query";
import { tenantTaxonomyQuerySchema } from "../lib/tenant-taxonomy-query";
import { catalogTranslationReadinessQuerySchema } from "../lib/catalog-translation-readiness";

const additionalDataValidator = {
  [PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY]:
    productOptionValuePresentationsAdditionalDataSchema.optional(),
};

export default defineMiddlewares({
  routes: [
    {
      method: "POST",
      matcher: "/admin/platform-draft-orders/:id/manual-discount",
      middlewares: [validateAndTransformBody(manualOrderAdjustmentSchema)],
    },
    {
      method: "GET",
      matcher: "/store/product-search",
      middlewares: [validateAndTransformQuery(productSearchQuerySchema, {})],
    },
    {
      method: "GET",
      matcher: "/admin/product-search",
      middlewares: [validateAndTransformQuery(adminProductSearchQuerySchema, {})],
    },
    {
      method: "GET",
      matcher: "/admin/platform-translation-readiness",
      middlewares: [
        validateAndTransformQuery(catalogTranslationReadinessQuerySchema, {}),
      ],
    },
    {
      method: "POST",
      matcher: "/admin/product-search",
      middlewares: [
        validateAndTransformBody(z.object({ ids: z.array(z.string().trim().min(1)).min(1).max(100) })),
      ],
    },
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
      middlewares: [
        validateAndTransformQuery(productMediaQuerySchema, listProductQueryConfig),
        // This route always uses graph, so resolve the cross-module link even
        // when the native product endpoint's optional index engine is enabled.
        maybeApplyLinkFilter({
          entryPoint: "product_sales_channel",
          resourceId: "product_id",
          filterableField: "sales_channel_id",
        }),
      ],
    },
    {
      method: "POST",
      matcher: "/admin/platform-products/:id",
      middlewares: [validateAndTransformBody(platformProductUpdateSchema)],
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
