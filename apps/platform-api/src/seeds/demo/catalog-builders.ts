import type { DemoProduct, DemoProductOption } from "./types.js";

export function matrixProduct(
  title: string,
  handle: string,
  imageCategory: string,
  basePrice: number,
  optionAxes: readonly DemoProductOption[],
  stockPattern: readonly number[],
  description?: string,
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
    variants: combos.map((options, index) => {
      const label = optionAxes.map((axis) => options[axis.title]).join(" / ");
      const stock = stockPattern[index % stockPattern.length] ?? 20;
      return {
        options,
        title: `${title} / ${label}`,
        sku: `${skuBase}_${index + 1}`,
        price: basePrice + index * Math.round(basePrice * 0.08),
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
): DemoProduct {
  return matrixProduct(
    title,
    handle,
    imageCategory,
    basePrice,
    [{ title: optionTitle, values }],
    stockPattern,
    description,
  );
}
