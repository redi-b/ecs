export function getProductOptionSetValues(body: Record<string, unknown>) {
  if (!Array.isArray(body.values)) return null;
  return body.values.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as Record<string, unknown>;
    if (typeof value.label !== "string") return [];
    const swatch = value.swatch;
    const swatchRecord =
      swatch && typeof swatch === "object" ? (swatch as Record<string, unknown>) : null;
    const normalizedSwatch =
      swatchRecord?.kind === "color" && typeof swatchRecord.value === "string"
        ? { kind: "color" as const, value: swatchRecord.value }
        : swatchRecord?.kind === "image" && typeof swatchRecord.url === "string"
          ? { kind: "image" as const, url: swatchRecord.url }
          : undefined;
    const displayMode =
      value.displayMode === "text"
        ? ("text" as const)
        : value.displayMode === "swatch"
          ? ("swatch" as const)
          : null;
    return [
      {
        label: value.label,
        ...(displayMode === "text" || displayMode === "swatch" ? { displayMode } : {}),
        ...(normalizedSwatch ? { swatch: normalizedSwatch } : {}),
      },
    ];
  });
}
