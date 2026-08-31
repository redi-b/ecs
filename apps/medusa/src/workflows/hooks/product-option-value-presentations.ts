import { StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

import {
  buildOptionValuePresentationMutations,
  readOptionValuePresentationPayload,
  type OptionValuePresentationMutation,
} from "../../lib/product-option-value-presentations.js";

type CompensationData = Array<Pick<OptionValuePresentationMutation, "id" | "previousMetadata">>;

async function applyPresentations(
  productIds: string[],
  additionalData: unknown,
  container: { resolve: (key: string) => any },
) {
  const payload = readOptionValuePresentationPayload(additionalData);
  if (!payload) return new StepResponse([], [] satisfies CompensationData);

  const productService = container.resolve(Modules.PRODUCT);
  const products = await productService.listProducts(
    { id: productIds },
    { relations: ["options", "options.values"] },
  );
  const mutations = buildOptionValuePresentationMutations(products, payload.values);
  const applied: OptionValuePresentationMutation[] = [];

  try {
    for (const mutation of mutations) {
      await productService.updateProductOptionValues(mutation.id, {
        metadata: mutation.metadata,
      });
      applied.push(mutation);
    }
  } catch (error) {
    // The hook cannot return compensation data until its action completes. Roll
    // back an incomplete batch here, while the normal compensation below still
    // handles failures in later workflow steps.
    for (const mutation of applied.reverse()) {
      await productService.updateProductOptionValues(mutation.id, {
        metadata: mutation.previousMetadata,
      });
    }
    throw error;
  }

  return new StepResponse(
    mutations.map(({ id, metadata }) => ({ id, metadata })),
    mutations.map(({ id, previousMetadata }) => ({ id, previousMetadata })),
  );
}

async function compensatePresentations(
  mutations: CompensationData | undefined,
  container: { resolve: (key: string) => any },
) {
  if (!mutations?.length) return;
  const productService = container.resolve(Modules.PRODUCT);

  for (const mutation of mutations) {
    await productService.updateProductOptionValues(mutation.id, {
      metadata: mutation.previousMetadata,
    });
  }
}

createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) =>
    applyPresentations(
      products.map((product) => product.id),
      additional_data,
      container,
    ),
  async (mutations, { container }) => compensatePresentations(mutations, container),
);

updateProductsWorkflow.hooks.productsUpdated(
  async ({ products, additional_data }, { container }) =>
    applyPresentations(
      products.map((product) => product.id),
      additional_data,
      container,
    ),
  async (mutations, { container }) => compensatePresentations(mutations, container),
);
