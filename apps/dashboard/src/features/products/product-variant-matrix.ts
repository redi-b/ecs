export type ProductOptionDraft = {
  title: string;
  values: string[];
};

export type VariantDefaults = {
  currencyCode: string;
  priceAmount: number;
  skuPrefix: string;
  stockedQuantity: number;
};

export type VariantOverride = {
  priceAmount?: number | undefined;
  sku?: string | undefined;
  stockedQuantity?: number | undefined;
};

export type VariantMatrixRow = {
  currencyCode: string;
  key: string;
  optionValues: Record<string, string>;
  priceAmount: number;
  sku: string;
  stockedQuantity: number;
};

export function getVariantMatrixKey(optionValues: Record<string, string>) {
  return Object.entries(optionValues)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, value]) => `${title}:${value}`)
    .join("|");
}

export function buildVariantMatrix(input: {
  defaults: VariantDefaults;
  options: ProductOptionDraft[];
  overrides: Map<string, VariantOverride>;
}): VariantMatrixRow[] {
  const options = input.options
    .map((option) => ({
      title: option.title.trim(),
      values: option.values.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((option) => option.title && option.values.length);

  if (!options.length) {
    const key = "default";
    const override = input.overrides.get(key);

    return [
      {
        currencyCode: input.defaults.currencyCode,
        key,
        optionValues: {},
        priceAmount: override?.priceAmount ?? input.defaults.priceAmount,
        sku: override?.sku ?? input.defaults.skuPrefix.trim(),
        stockedQuantity: override?.stockedQuantity ?? input.defaults.stockedQuantity,
      },
    ];
  }

  const combinations = options.reduce<Array<Record<string, string>>>(
    (rows, option) =>
      rows.flatMap((row) =>
        option.values.map((value) => ({
          ...row,
          [option.title]: value,
        })),
      ),
    [{}],
  );

  return combinations.map((optionValues) => {
    const key = getVariantMatrixKey(optionValues);
    const override = input.overrides.get(key);
    const skuSuffix = Object.values(optionValues)
      .map((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "-"))
      .join("-");
    const skuPrefix = input.defaults.skuPrefix.trim();

    return {
      currencyCode: input.defaults.currencyCode,
      key,
      optionValues,
      priceAmount: override?.priceAmount ?? input.defaults.priceAmount,
      sku: override?.sku ?? [skuPrefix, skuSuffix].filter(Boolean).join("-"),
      stockedQuantity: override?.stockedQuantity ?? input.defaults.stockedQuantity,
    };
  });
}
