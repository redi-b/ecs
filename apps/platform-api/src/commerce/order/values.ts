export function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}


export function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}


export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
