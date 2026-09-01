import type { ProductTypes } from "@medusajs/framework/types";

import {
  PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY,
  PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY,
  type ProductOptionValuePresentationWrite,
  productOptionValuePresentationsAdditionalDataSchema,
} from "./product-option-value-presentation-contract";

type ProductWithOptions = Pick<ProductTypes.ProductDTO, "id"> & {
  options?: ProductTypes.ProductOptionDTO[] | null;
};

export type OptionValuePresentationMutation = {
  id: string;
  metadata: Record<string, unknown>;
  previousMetadata: Record<string, unknown>;
};

function normalizedIdentity(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function readOptionValuePresentationPayload(additionalData: unknown) {
  if (!additionalData || typeof additionalData !== "object") return null;

  const raw = (additionalData as Record<string, unknown>)[
    PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY
  ];
  if (raw === undefined) return null;

  return productOptionValuePresentationsAdditionalDataSchema.parse(raw);
}

export function buildOptionValuePresentationMutations(
  products: ProductWithOptions[],
  presentations: ProductOptionValuePresentationWrite[],
): OptionValuePresentationMutation[] {
  if (products.length !== 1) {
    throw new Error("Option value presentations require exactly one product per request.");
  }

  const options = products[0]?.options ?? [];
  const claimedValueIds = new Set<string>();

  return presentations.map((presentation) => {
    const matchingOptions = options.filter((option) =>
      presentation.optionId
        ? option.id === presentation.optionId
        : normalizedIdentity(option.title) === normalizedIdentity(presentation.optionTitle),
    );

    if (matchingOptions.length !== 1) {
      throw new Error(`Could not uniquely match product option "${presentation.optionTitle}".`);
    }

    const option = matchingOptions[0]!;
    const matchingValues = (option.values ?? []).filter((value) =>
      presentation.valueId
        ? value.id === presentation.valueId
        : normalizedIdentity(value.value) === normalizedIdentity(presentation.valueLabel),
    );

    if (matchingValues.length !== 1) {
      throw new Error(
        `Could not uniquely match product option value "${presentation.valueLabel}".`,
      );
    }

    const value = matchingValues[0]!;
    if (claimedValueIds.has(value.id)) {
      throw new Error(`Product option value "${presentation.valueLabel}" was specified twice.`);
    }
    claimedValueIds.add(value.id);

    const previousMetadata = { ...(value.metadata ?? {}) } as Record<string, unknown>;
    const metadata = { ...previousMetadata };

    if (presentation.swatch) {
      metadata[PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY] = {
        version: 1,
        swatch: {
          kind: "color",
          value: presentation.swatch.value.toLowerCase(),
        },
      };
    } else {
      delete metadata[PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY];
    }

    return { id: value.id, metadata, previousMetadata };
  });
}
