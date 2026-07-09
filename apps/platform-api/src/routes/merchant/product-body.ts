export function getOptionalBodyProductOptions(body: unknown) {
  if (!body || typeof body !== "object" || !("options" in body)) {
    return undefined;
  }

  const options = (body as { options?: unknown }).options;

  if (!Array.isArray(options)) {
    return undefined;
  }

  return options.flatMap((option) => {
    if (!option || typeof option !== "object") {
      return [];
    }

    const title =
      typeof (option as { title?: unknown }).title === "string"
        ? (option as { title: string }).title.trim()
        : "";
    const values = Array.isArray((option as { values?: unknown }).values)
      ? (option as { values: unknown[] }).values
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    return title && values.length ? [{ title, values }] : [];
  });
}

export function getOptionalBodyProductVariants(body: unknown) {
  if (!body || typeof body !== "object" || !("variants" in body)) {
    return undefined;
  }

  const variants = (body as { variants?: unknown }).variants;

  if (!Array.isArray(variants)) {
    return undefined;
  }

  const normalizedVariants = variants.flatMap((variant) => {
    if (!variant || typeof variant !== "object") {
      return [];
    }

    const optionValues = getProductVariantOptionValues(
      (variant as { optionValues?: unknown }).optionValues,
    );
    const priceAmount = (variant as { priceAmount?: unknown }).priceAmount;
    const currencyCode =
      typeof (variant as { currencyCode?: unknown }).currencyCode === "string"
        ? (variant as { currencyCode: string }).currencyCode.trim().toLowerCase()
        : "";
    const sku =
      typeof (variant as { sku?: unknown }).sku === "string"
        ? (variant as { sku: string }).sku.trim()
        : undefined;
    const stockedQuantity = (variant as { stockedQuantity?: unknown }).stockedQuantity;

    if (
      !currencyCode ||
      typeof priceAmount !== "number" ||
      !Number.isFinite(priceAmount) ||
      Object.keys(optionValues).length === 0
    ) {
      return [];
    }

    return [
      {
        currencyCode,
        optionValues,
        priceAmount,
        ...(sku ? { sku } : {}),
        ...(typeof stockedQuantity === "number" && Number.isFinite(stockedQuantity)
          ? { stockedQuantity }
          : {}),
      },
    ];
  });

  return normalizedVariants.length ? normalizedVariants : undefined;
}

function getProductVariantOptionValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((result, [key, entry]) => {
    const optionTitle = key.trim();
    const optionValue = typeof entry === "string" ? entry.trim() : "";

    if (optionTitle && optionValue) {
      result[optionTitle] = optionValue;
    }

    return result;
  }, {});
}
