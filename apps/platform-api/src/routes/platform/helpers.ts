export function getRequestValue(body: unknown, url: URL, ...keys: string[]) {
  for (const key of keys) {
    const value = url.searchParams.get(key);

    if (value) {
      return value;
    }
  }

  if (typeof body !== "object" || body === null) {
    return undefined;
  }

  const record = body as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

export function getOptionalBodyBoolean(body: unknown, key: string, defaultValue: boolean) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return defaultValue;
  }

  const value = (body as Record<string, unknown>)[key];

  return typeof value === "boolean" ? value : defaultValue;
}
