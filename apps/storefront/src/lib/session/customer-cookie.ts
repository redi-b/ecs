const CUSTOMER_SESSION_COOKIE = "ecs_customer_session";
const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function parseCookieHeader(header: string | null) {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies.set(key, decodeURIComponent(rest.join("=")));
  }
  return cookies;
}

export function getCustomerTokenFromRequest(request: Request) {
  return parseCookieHeader(request.headers.get("cookie")).get(CUSTOMER_SESSION_COOKIE)?.trim() || null;
}

export function customerSessionSetCookie(token: string) {
  return serializeCustomerCookie(token, CUSTOMER_SESSION_MAX_AGE);
}

export function customerSessionClearCookie() {
  return serializeCustomerCookie("", 0);
}

function serializeCustomerCookie(value: string, maxAge: number) {
  const parts = [
    `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
