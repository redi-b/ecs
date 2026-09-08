export function getProductOptionSetValues(body: Record<string, unknown>) {
  if (!Array.isArray(body.values)) return null;
  return body.values.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as Record<string, unknown>;
    if (typeof value.label !== "string") return [];
    const swatch = value.swatch;
    return [
      {
        label: value.label,
        ...(swatch &&
        typeof swatch === "object" &&
        (swatch as Record<string, unknown>).kind === "color" &&
        typeof (swatch as Record<string, unknown>).value === "string"
          ? {
              swatch: {
                kind: "color" as const,
                value: (swatch as Record<string, unknown>).value as string,
              },
            }
          : {}),
      },
    ];
  });
}
