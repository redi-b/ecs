import {
  createAndLinkProductOptionsToProductWorkflow,
  type LinkProductOptionsToProductWorkflowInput,
  type UpdateProductWorkflowInput,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { PlatformProductUpdateInput } from "../lib/platform-product-update";
import { productUpdateChangesMedia } from "../lib/product-variant-media";
import { reconcileProductVariantImagesWorkflow } from "./reconcile-product-variant-images";

type Input = PlatformProductUpdateInput & { product_id: string };

const applyPlatformProductOptionsBeforeUpdateWorkflow = createWorkflow(
  "apply-platform-product-options-before-update",
  function (input: LinkProductOptionsToProductWorkflowInput) {
    createAndLinkProductOptionsToProductWorkflow.runAsStep({ input });
    return new WorkflowResponse(void 0);
  },
);

const applyPlatformProductOptionsAfterUpdateWorkflow = createWorkflow(
  "apply-platform-product-options-after-update",
  function (input: LinkProductOptionsToProductWorkflowInput) {
    createAndLinkProductOptionsToProductWorkflow.runAsStep({ input });
    return new WorkflowResponse(void 0);
  },
);

/**
 * Reconciles option axes and variants as one compensating workflow. This is
 * intentionally one Medusa operation: a failed variant write must not leave
 * newly-created or duplicate option axes behind.
 */
export const updatePlatformProductWorkflow = createWorkflow(
  "update-platform-product",
  function (input: Input) {
    const beforeOptions = transform(
      { input },
      ({ input }) =>
        ({
          product_id: input.product_id,
          add: input.before_options?.add ?? [],
          remove: input.before_options?.remove ?? [],
          update: (input.before_options?.update ?? []).map((item) => ({
            product_option_id: item.product_option_id,
            ...(item.add?.length ? { add: item.add } : {}),
            ...(item.remove?.length ? { remove: item.remove } : {}),
          })),
        }) satisfies LinkProductOptionsToProductWorkflowInput,
    );
    applyPlatformProductOptionsBeforeUpdateWorkflow.runAsStep({ input: beforeOptions });

    const productUpdate = transform({ input }, ({ input }) => {
      const { additional_data, ...update } = input.update;
      return {
        selector: { id: input.product_id },
        update,
        ...(additional_data && typeof additional_data === "object"
          ? { additional_data: additional_data as Record<string, unknown> }
          : {}),
      } as UpdateProductWorkflowInput;
    });
    const products = updateProductsWorkflow.runAsStep({ input: productUpdate });

    const afterOptions = transform(
      { input },
      ({ input }) =>
        ({
          product_id: input.product_id,
          add: input.after_options?.add ?? [],
          remove: input.after_options?.remove ?? [],
          update: (input.after_options?.update ?? []).map((item) => ({
            product_option_id: item.product_option_id,
            ...(item.add?.length ? { add: item.add } : {}),
            ...(item.remove?.length ? { remove: item.remove } : {}),
          })),
        }) satisfies LinkProductOptionsToProductWorkflowInput,
    );
    applyPlatformProductOptionsAfterUpdateWorkflow.runAsStep({ input: afterOptions });

    const photoChanges = when(
      { input, products },
      ({ input, products }) => products.length > 0 && productUpdateChangesMedia(input.update),
    ).then(() =>
      reconcileProductVariantImagesWorkflow.runAsStep({
        input: { productId: input.product_id },
      }),
    );
    const result = transform({ products, photoChanges }, ({ products, photoChanges }) => {
      const metadataById = new Map((photoChanges ?? []).map((patch) => [patch.id, patch.metadata]));
      return products.map((product) => ({
        ...product,
        variants: product.variants?.map((variant) => ({
          ...variant,
          ...(metadataById.has(variant.id) ? { metadata: metadataById.get(variant.id) } : {}),
        })),
      }));
    });

    return new WorkflowResponse(result);
  },
);
