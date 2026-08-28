import type { APIRoute } from "astro";

import {
  getStoreCustomerCommerceState,
  type StoreCustomerWishlistEntry,
  saveStoreCustomerWishlist,
} from "../../../lib/commerce/account.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";

export const GET: APIRoute = async ({ request }) => {
  const token = getCustomerTokenFromRequest(request);
  if (!token) return Response.json({ authenticated: false, items: [] });
  const state = await getStoreCustomerCommerceState({
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
    token,
  });
  return "ok" in state
    ? Response.json({ message: state.message }, { status: state.status })
    : Response.json({ authenticated: true, items: state.wishlist });
};

export const PUT: APIRoute = async ({ request }) => {
  const token = getCustomerTokenFromRequest(request);
  if (!token) return Response.json({ authenticated: false, items: [] }, { status: 401 });
  const body = await request.json().catch(() => null);
  const items = normalizeItems(body);
  if (!items) return Response.json({ message: "Invalid wishlist." }, { status: 422 });
  const state = await saveStoreCustomerWishlist({
    items,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
    token,
  });
  return "ok" in state
    ? Response.json({ message: state.message }, { status: state.status })
    : Response.json({ authenticated: true, items: state.wishlist });
};

function normalizeItems(value: unknown): StoreCustomerWishlistEntry[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>).items;
  if (!Array.isArray(raw) || raw.length > 200) return null;
  const items: StoreCustomerWishlistEntry[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.path !== "string" ||
      !item.path.startsWith("/products/") ||
      item.path.length > 500
    )
      return null;
    items.push({
      path: item.path,
      title:
        typeof item.title === "string" && item.title.trim() ? item.title.slice(0, 200) : "Product",
      thumbnail: typeof item.thumbnail === "string" ? item.thumbnail.slice(0, 2_000) : null,
      priceAmount:
        typeof item.priceAmount === "number" &&
        Number.isFinite(item.priceAmount) &&
        item.priceAmount >= 0
          ? item.priceAmount
          : null,
      currencyCode: typeof item.currencyCode === "string" ? item.currencyCode.slice(0, 10) : null,
    });
  }
  return items;
}
