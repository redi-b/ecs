import { updateProductVariantsWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { getVariantImageUpdates } from "../lib/product-variant-media";

/**
 * Keep automatic variant photos aligned with the saved gallery and tags.
 * The built-in workflow patches metadata only, with compensation on failure.
 */
export const reconcileProductVariantImagesWorkflow = createWorkflow(
  "reconcile-product-variant-images",
  function (input: { productId: string }) {
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "thumbnail",
        "images.url",
        "metadata",
        "variants.id",
        "variants.metadata",
        "variants.options.value",
        "variants.options.option.title",
      ],
      filters: { id: input.productId },
      options: { throwIfKeyNotFound: true },
    });
    const patches = transform({ products }, ({ products }) => getVariantImageUpdates(products[0]));
    when({ patches }, ({ patches }) => patches.length > 0).then(() => {
      updateProductVariantsWorkflow.runAsStep({
        input: { product_variants: patches },
      });
    });
    return new WorkflowResponse(patches);
  },
);
