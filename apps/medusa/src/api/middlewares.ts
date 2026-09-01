import { defineMiddlewares } from "@medusajs/framework/http";

import {
  PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY,
  productOptionValuePresentationsAdditionalDataSchema,
} from "../lib/product-option-value-presentation-contract";

const additionalDataValidator = {
  [PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY]:
    productOptionValuePresentationsAdditionalDataSchema.optional(),
};

export default defineMiddlewares({
  routes: [
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
