import { headers } from "next/headers";

/** Build better-auth proxy context from the incoming dashboard request. */
export async function getAccountAuthRequestContext(request?: Request) {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    (request ? new URL(request.url).host : null);
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (request ? new URL(request.url).protocol.replace(":", "") : "http");
  const origin =
    requestHeaders.get("origin") ??
    (host ? `${proto}://${host}` : null);

  return {
    cookieHeader: requestHeaders.get("cookie"),
    origin,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: host,
    requestProto: proto,
  };
}
