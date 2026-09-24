export type ApiErrorKind =
  | "auth"
  | "permission"
  | "validation"
  | "conflict"
  | "not-found"
  | "rate-limit"
  | "server"
  | "network";

export class DashboardApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

export function apiErrorKindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation";
  if (status === 429) return "rate-limit";
  return "server";
}
