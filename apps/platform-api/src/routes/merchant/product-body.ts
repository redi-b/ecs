import { productOptionMediaBindingsSchema } from "@ecs/contracts";

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
    const id = getTrimmedString((option as { id?: unknown }).id);
    const values = Array.isArray((option as { values?: unknown }).values)
      ? (option as { values: unknown[] }).values.flatMap((value) => {
          if (typeof value === "string") {
            const label = value.trim();
            return label ? [{ label }] : [];
          }
          if (!value || typeof value !== "object") return [];

          const label = getTrimmedString((value as { label?: unknown }).label);
          if (!label) return [];
          const valueId = getTrimmedString((value as { id?: unknown }).id);
          const hasSwatch = Object.hasOwn(value, "swatch");
          const swatch = getProductOptionSwatch((value as { swatch?: unknown }).swatch);

          return [
            {
              label,
              ...(valueId ? { id: valueId } : {}),
              ...(hasSwatch ? { swatch } : {}),
            },
          ];
        })
      : [];

    return title && values.length ? [{ title, values, ...(id ? { id } : {}) }] : [];
  });
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getProductOptionSwatch(value: unknown) {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "color") {
    const color = getTrimmedString((value as { value?: unknown }).value);
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
    if (!match) return undefined;
    const hex = match[1]!.toLowerCase();
    return {
      kind: "color" as const,
      value:
        hex.length === 3
          ? `#${hex
              .split("")
              .map((character) => character.repeat(2))
              .join("")}`
          : `#${hex}`,
    };
  }
  if (kind === "image") {
    const url = getTrimmedString((value as { url?: unknown }).url);
    if (!url) return undefined;
    try {
      new URL(url);
      return {
        kind: "image" as const,
        url,
      };
    } catch {
      return undefined;
    }
  }
  return undefined;
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
    const id = getTrimmedString((variant as { id?: unknown }).id);
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
    const imageUrl =
      typeof (variant as { imageUrl?: unknown }).imageUrl === "string"
        ? (variant as { imageUrl: string }).imageUrl.trim()
        : (variant as { imageUrl?: unknown }).imageUrl === null
          ? null
          : undefined;

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
        ...(id ? { id } : {}),
        optionValues,
        priceAmount,
        ...(sku ? { sku } : {}),
        ...(typeof stockedQuantity === "number" && Number.isFinite(stockedQuantity)
          ? { stockedQuantity }
          : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      },
    ];
  });

  return normalizedVariants.length ? normalizedVariants : undefined;
}

export function getOptionalBodyOptionMediaBindings(body: unknown) {
  if (!body || typeof body !== "object" || !("optionMediaBindings" in body)) {
    return undefined;
  }
  const raw = (body as { optionMediaBindings?: unknown }).optionMediaBindings;
  if (raw === null) return null;
  const parsed = productOptionMediaBindingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
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
