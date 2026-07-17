const CART_COOKIE = "ecs_cart_id";
const LAST_ORDER_COOKIE = "ecs_last_order";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type LastOrderCookie = {
  currencyCode: string | null;
  id: string;
  total: number | null;
};

function parseCookieHeader(header: string | null) {
  const map = new Map<string, string>();

  if (!header) {
    return map;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) {
      continue;
    }
    map.set(rawKey, decodeURIComponent(rest.join("=") ?? ""));
  }

  return map;
}

export function getCartIdFromRequest(request: Request) {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const value = cookies.get(CART_COOKIE)?.trim();
  return value || null;
}

export function getLastOrderFromRequest(request: Request): LastOrderCookie | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const raw = cookies.get(LAST_ORDER_COOKIE);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LastOrderCookie>;
    if (typeof parsed.id !== "string" || !parsed.id.trim()) {
      return null;
    }
    return {
      currencyCode: typeof parsed.currencyCode === "string" ? parsed.currencyCode : null,
      id: parsed.id.trim(),
      total: typeof parsed.total === "number" ? parsed.total : null,
    };
  } catch {
    return null;
  }
}

function serializeCookie(
  name: string,
  value: string,
  options?: {
    maxAge?: number;
    clear?: boolean;
  },
) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (options?.clear) {
    parts.push("Max-Age=0");
  } else {
    parts.push(`Max-Age=${options?.maxAge ?? MAX_AGE_SECONDS}`);
  }

  return parts.join("; ");
}

export function cartIdSetCookie(cartId: string) {
  return serializeCookie(CART_COOKIE, cartId);
}

export function cartIdClearCookie() {
  return serializeCookie(CART_COOKIE, "", { clear: true });
}

export function lastOrderSetCookie(order: LastOrderCookie) {
  return serializeCookie(LAST_ORDER_COOKIE, JSON.stringify(order), {
    maxAge: 60 * 60 * 24,
  });
}

export function appendSetCookies(headers: Headers, cookies: string[]) {
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
}
