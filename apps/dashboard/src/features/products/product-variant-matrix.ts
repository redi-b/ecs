import type { ProductOptionSwatch } from "@ecs/contracts";

export type ProductOptionDraft = {
  displayMode?: "text" | "swatch" | undefined;
  id?: string | undefined;
  key?: string | undefined;
  savedOptionSetId?: string | undefined;
  savedOptionSnapshot?: string | undefined;
  title: string;
  values: ProductOptionValueDraft[];
};

export type ProductOptionValueDraft = {
  id?: string | undefined;
  key?: string | undefined;
  label: string;
  swatch?: ProductOptionSwatch | null | undefined;
};

export type VariantDefaults = {
  currencyCode: string;
  priceAmount: number;
  skuPrefix: string;
  stockedQuantity: number;
};

export type VariantOverride = {
  enabled?: boolean | undefined;
  id?: string | undefined;
  imageUrl?: string | undefined;
  priceAmount?: number | undefined;
  reservedQuantity?: number | undefined;
  sku?: string | undefined;
  stockedQuantity?: number | undefined;
};

export type VariantMatrixRow = {
  currencyCode: string;
  enabled: boolean;
  id?: string | undefined;
  imageUrl?: string | undefined;
  key: string;
  optionValues: Record<string, string>;
  priceAmount: number;
  reservedQuantity: number;
  sku: string;
  stockedQuantity: number;
};

export function getVariantMatrixKey(optionValues: Record<string, string>) {
  return Object.entries(optionValues)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, value]) => `${title}:${value}`)
    .join("|");
}

/** Draft identity survives label edits and option reordering when Medusa IDs are available. */
export function getVariantDraftKey(
  selections: Array<{
    option: Pick<ProductOptionDraft, "id" | "key" | "title">;
    value: Pick<ProductOptionValueDraft, "id" | "key" | "label">;
  }>,
) {
  return selections
    .map(({ option, value }): [string, string] => [
      option.id ?? option.key ?? `title:${option.title.trim().toLocaleLowerCase()}`,
      value.id ?? value.key ?? `label:${value.label.trim().toLocaleLowerCase()}`,
    ])
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([option, value]) => `${option}:${value}`)
    .join("|");
}

export function buildVariantMatrix(input: {
  defaults: VariantDefaults;
  options: ProductOptionDraft[];
  overrides: Map<string, VariantOverride>;
}): VariantMatrixRow[] {
  const options = input.options
    .map((option) => ({
      option,
      title: option.title.trim(),
      values: option.values
        .map((value) => ({ value, label: value.label.trim() }))
        .filter(({ label }) => Boolean(label)),
    }))
    .filter((option) => option.title && option.values.length);

  if (!options.length) {
    const key = "default";
    const override = input.overrides.get(key);

    return [
      {
        currencyCode: input.defaults.currencyCode,
        enabled: override?.enabled ?? true,
        ...(override?.id ? { id: override.id } : {}),
        ...(override?.imageUrl ? { imageUrl: override.imageUrl } : {}),
        key,
        optionValues: {},
        priceAmount: override?.priceAmount ?? input.defaults.priceAmount,
        reservedQuantity: override?.reservedQuantity ?? 0,
        sku: override?.sku ?? input.defaults.skuPrefix.trim(),
        stockedQuantity: override?.stockedQuantity ?? input.defaults.stockedQuantity,
      },
    ];
  }

  const combinations = options.reduce<
    Array<
      Array<{
        label: string;
        option: ProductOptionDraft;
        title: string;
        value: ProductOptionValueDraft;
      }>
    >
  >(
    (rows, option) =>
      rows.flatMap((row) =>
        option.values.map(({ value, label }) => [
          ...row,
          { option: option.option, value, title: option.title, label },
        ]),
      ),
    [[]],
  );

  return combinations.map((combination) => {
    const optionValues = Object.fromEntries(combination.map(({ title, label }) => [title, label]));
    const key = getVariantDraftKey(combination);
    const override = input.overrides.get(key);
    const skuSuffix = Object.values(optionValues)
      .map((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "-"))
      .join("-");
    const skuPrefix = input.defaults.skuPrefix.trim();

    return {
      currencyCode: input.defaults.currencyCode,
      enabled: override?.enabled ?? true,
      ...(override?.id ? { id: override.id } : {}),
      ...(override?.imageUrl ? { imageUrl: override.imageUrl } : {}),
      key,
      optionValues,
      priceAmount: override?.priceAmount ?? input.defaults.priceAmount,
      reservedQuantity: override?.reservedQuantity ?? 0,
      sku: override?.sku ?? (skuPrefix ? `${skuPrefix}-${skuSuffix}` : ""),
      stockedQuantity: override?.stockedQuantity ?? input.defaults.stockedQuantity,
    };
  });
}
