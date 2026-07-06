import { DashboardApiError, apiErrorKindFromStatus } from "@/lib/api/errors";

function createDashboardHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (
    init?.body !== undefined &&
    !headers.has("content-type") &&
    !(init.body instanceof FormData)
  ) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

async function parseDashboardResponse<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const body = await response.text();

  if (!body) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return JSON.parse(body) as T;
  }

  return body as T;
}

export async function dashboardFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: createDashboardHeaders(init),
    });
  } catch (error) {
    throw new DashboardApiError(
      error instanceof Error ? error.message : "Network error",
      "network",
    );
  }

  if (!response.ok) {
    throw new DashboardApiError(
      `Request failed with status ${response.status}`,
      apiErrorKindFromStatus(response.status),
      response.status,
    );
  }

  return parseDashboardResponse<T>(response);
}
