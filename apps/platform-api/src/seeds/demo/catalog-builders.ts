import type { DemoProduct, DemoProductOption } from "./types.js";

export type RichDescriptionOptions = {
  overview: string;
  features?: readonly string[];
  specs?: Record<string, string>;
  inTheBox?: readonly string[];
  note?: string;
};

/**
 * Builds rich, beautifully formatted Markdown description for storefronts.
 */
export function buildRichDescription(options: RichDescriptionOptions): string {
  const parts: string[] = [options.overview.trim()];

  if (options.features && options.features.length > 0) {
    parts.push("### Key Highlights");
    parts.push(options.features.map((f) => `- ${f}`).join("\n"));
  }

  if (options.specs && Object.keys(options.specs).length > 0) {
    parts.push("### Specifications");
    const rows = Object.entries(options.specs).map(
      ([key, val]) => `| **${key}** | ${val} |`,
    );
    parts.push("| Specification | Detail |\n| :--- | :--- |\n" + rows.join("\n"));
  }

  if (options.inTheBox && options.inTheBox.length > 0) {
    parts.push("### What's In The Box");
    parts.push(options.inTheBox.map((item) => `- ${item}`).join("\n"));
  }

  if (options.note) {
    parts.push(`> **Delivery & Assurance:** ${options.note}`);
  }

  return parts.join("\n\n");
}

export function matrixProduct(
  title: string,
  handle: string,
  imageCategory: string,
  basePrice: number,
  optionAxes: readonly DemoProductOption[],
  stockPattern: readonly number[],
  description?: string,
  extra?: {
    originalPrice?: number;
    priceMultipliers?: readonly number[];
    swatches?: Record<string, Record<string, { kind: "color"; value: string }>>;
    optionMediaBindings?: { optionTitle: string; mappings: Record<string, string[]> };
  },
): DemoProduct {
  const combos: Array<Record<string, string>> = [{}];
  for (const axis of optionAxes) {
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const value of axis.values) {
        next.push({ ...combo, [axis.title]: value });
      }
    }
    combos.splice(0, combos.length, ...next);
  }

  const skuBase = handle.toUpperCase().replaceAll("-", "_");
  return {
    title,
    handle,
    imageCategory,
    description: description ?? `${title}. Local delivery and cash on delivery available.`,
    options: optionAxes,
    originalPrice: extra?.originalPrice,
    optionPresentation: extra?.swatches,
    optionMediaBindings: extra?.optionMediaBindings,
    variants: combos.map((options, index) => {
      const label = optionAxes.map((axis) => options[axis.title]).join(" / ");
      const stock = stockPattern[index % stockPattern.length] ?? 20;
      const multiplier = extra?.priceMultipliers?.[index] ?? 1 + index * 0.08;
      const price = Math.round(basePrice * multiplier);
      const originalPrice = extra?.originalPrice
        ? Math.round(extra.originalPrice * multiplier)
        : undefined;

      return {
        options,
        title: `${title} / ${label}`,
        sku: `${skuBase}_${index + 1}`,
        price,
        originalPrice,
        stock,
      };
    }),
  };
}

/** Single-axis product (storage, size, color, etc.). */
export function singleAxisProduct(
  title: string,
  handle: string,
  imageCategory: string,
  basePrice: number,
  optionTitle: string,
  values: readonly string[],
  stockPattern: readonly number[] = [40, 12, 3, 0],
  description?: string,
  extra?: {
    originalPrice?: number;
    priceMultipliers?: readonly number[];
    swatches?: Record<string, Record<string, { kind: "color"; value: string }>>;
    optionMediaBindings?: { optionTitle: string; mappings: Record<string, string[]> };
  },
): DemoProduct {
  return matrixProduct(
    title,
    handle,
    imageCategory,
    basePrice,
    [{ title: optionTitle, values }],
    stockPattern,
    description,
    extra,
  );
}

/** Zero-option / single-variant standalone product. */
export function singleVariantProduct(
  title: string,
  handle: string,
  imageCategory: string,
  price: number,
  stock = 25,
  description?: string,
  extra?: {
    originalPrice?: number;
  },
): DemoProduct {
  const skuBase = handle.toUpperCase().replaceAll("-", "_");
  return {
    title,
    handle,
    imageCategory,
    description: description ?? `${title}. Local delivery and cash on delivery available.`,
    options: [],
    originalPrice: extra?.originalPrice,
    variants: [
      {
        options: {},
        title: `${title} / Standard`,
        sku: `${skuBase}_1`,
        price,
        originalPrice: extra?.originalPrice,
        stock,
      },
    ],
  };
}
