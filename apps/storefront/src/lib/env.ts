export function getPlatformApiBaseUrl() {
  return process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
}

export function getRequestHost(request: Request) {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
}
