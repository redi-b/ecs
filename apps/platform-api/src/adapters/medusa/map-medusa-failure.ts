/**
 * Map Medusa HTTP failures to platform merchant-safe error results.
 *
 * Contract:
 * - Network/missing response → 503 commerce_backend_unavailable
 * - 401/403 → 401 commerce_credentials_invalid
 * - 404 → notFoundError (or not_found)
 * - 409 → conflictError (or invalidError)
 * - 400/422 and other 4xx → invalidError at 400 (never collapse to 503)
 * - 5xx → 503 commerce_backend_unavailable
 */

export type MapMedusaFailureOptions = {
  /** Error code for 400/422 and other unmapped client errors. */
  invalidError?: string;
  /** Error code for 404. */
  notFoundError?: string;
  /** Error code for 409. Defaults to invalidError. */
  conflictError?: string;
  /** Error code for network / 5xx. */
  unavailableError?: string;
  /**
   * Optional body-based refinement for 4xx responses (not auth).
   * Return null/undefined to keep the default mapping.
   */
  refine?: (input: {
    status: number;
    body: unknown;
    blob: string;
  }) => { error: string; status: number } | null | undefined;
};

export type MedusaFailureResult = {
  ok: false;
  error: string;
  status: number;
};

const DEFAULT_INVALID = "invalid_request";
const DEFAULT_NOT_FOUND = "not_found";
const DEFAULT_UNAVAILABLE = "commerce_backend_unavailable";

export function mapMedusaHttpFailure(
  response: Response | null | undefined,
  options: MapMedusaFailureOptions = {},
): MedusaFailureResult {
  const invalidError = options.invalidError ?? DEFAULT_INVALID;
  const notFoundError = options.notFoundError ?? DEFAULT_NOT_FOUND;
  const conflictError = options.conflictError ?? invalidError;
  const unavailableError = options.unavailableError ?? DEFAULT_UNAVAILABLE;

  if (!response) {
    return { ok: false, error: unavailableError, status: 503 };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: "commerce_credentials_invalid", status: 401 };
  }

  if (response.status === 404) {
    return { ok: false, error: notFoundError, status: 404 };
  }

  if (response.status === 409) {
    return { ok: false, error: conflictError, status: 409 };
  }

  if (response.status === 400 || response.status === 422) {
    return { ok: false, error: invalidError, status: 400 };
  }

  // Other client errors (e.g. 405, 415) are still merchant-facing mistakes, not outages.
  if (response.status >= 400 && response.status < 500) {
    return { ok: false, error: invalidError, status: 400 };
  }

  return { ok: false, error: unavailableError, status: 503 };
}

/**
 * Same as mapMedusaHttpFailure, but can refine 4xx mappings from the JSON body
 * (e.g. promotion max_quantity → promotion_max_quantity_required).
 */
export async function mapMedusaFailure(
  response: Response | null | undefined,
  options: MapMedusaFailureOptions = {},
): Promise<MedusaFailureResult> {
  const base = mapMedusaHttpFailure(response, options);

  if (!response || !options.refine) {
    return base;
  }

  // Body refinement is only useful for non-auth client/server messages.
  if (response.status < 400) {
    return base;
  }
  if (response.status === 401 || response.status === 403) {
    return base;
  }

  const body = await response
    .clone()
    .json()
    .catch(() => null);
  const blob = JSON.stringify(body ?? {}).toLowerCase();
  const refined = options.refine({ status: response.status, body, blob });

  if (refined) {
    return { ok: false, error: refined.error, status: refined.status };
  }

  return base;
}

/**
 * Normalize a commerce failure status for Hono `context.json`.
 * Known merchant statuses pass through; other 4xx → 400; else 503.
 */
export function commerceErrorStatus(
  status: number,
): 400 | 401 | 403 | 404 | 409 | 422 | 503 {
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 409 ||
    status === 422 ||
    status === 503
  ) {
    return status;
  }
  if (status >= 400 && status < 500) {
    return 400;
  }
  return 503;
}
