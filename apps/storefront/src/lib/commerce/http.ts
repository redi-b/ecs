import { customerFacingStoreError } from "./errors.js";
import type { HostedStoreRequest, StorefrontError } from "./types.js";

export function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function getStoreHeaders(requestHost?: string | null, values?: Record<string, string>) {
  const headers = new Headers();

  if (requestHost?.trim()) {
    headers.set("x-forwarded-host", requestHost.trim());
  }

  for (const [key, value] of Object.entries(values ?? {})) {
    headers.set(key, value);
  }

  return headers;
}

export function getErrorMessage(data: unknown, fallback: string) {
  if (isRecord(data)) {
    const error = data.error ?? data.message;

    if (typeof error === "string" && error.trim()) {
      return customerFacingStoreError(error);
    }
  }

  return customerFacingStoreError(fallback || "Something went wrong. Please try again.");
}

export function asError(status: number, data: unknown, fallback: string): StorefrontError {
  return {
    ok: false,
    status,
    message: getErrorMessage(data, fallback),
  };
}

export async function storeFetch(
  options: HostedStoreRequest & {
    path: string;
    method?: string;
    body?: unknown;
    searchParams?: Record<string, string | number | undefined | null>;
  },
) {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(options.path.replace(/^\//, ""), normalizeBaseUrl(options.platformApiBaseUrl));

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value == null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const headers = getStoreHeaders(
    options.requestHost,
    options.body === undefined
      ? undefined
      : {
          "content-type": "application/json",
        },
  );

  const request = new Request(url, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET",
  });

  return fetcher(request);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}
