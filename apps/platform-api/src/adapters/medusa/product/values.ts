export function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}


export function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}


export function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}


export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


export function getErrorMessage(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  return (
    getString(value.message) ??
    getString(value.error) ??
    getString(value.type) ??
    getString(value.code)
  );
}


export async function isMissingCommerceResourceResponse(response: Response) {
  const data = await response.json().catch(() => undefined);
  const message = getErrorMessage(data);

  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();

  return (
    /(sales channel|sales_channel|sales-channel|product category|category|collection|inventory item|inventory_item|stock location|location|price list|price_list|price set|price_set|product|price).*(not found|does not exist|missing)/.test(
      normalized,
    ) ||
    /(not found|does not exist|missing).*(sales channel|sales_channel|sales-channel|product category|category|collection|inventory item|inventory_item|stock location|location|price list|price_list|price set|price_set|product|price)/.test(
      normalized,
    )
  );
}

