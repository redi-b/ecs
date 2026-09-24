export function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  // Medusa sometimes serializes quantities/prices as numeric strings.
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  // BigNumber-ish shapes: { value: "12", precision: 20 }
  if (isRecord(value) && "value" in value) {
    return getNumber(value.value);
  }

  return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
