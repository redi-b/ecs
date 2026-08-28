import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const response = await fetch(
      new URL("platform/merchant/analytics/visits", context.platformApiBaseUrl),
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
          cookie: context.cookieHeader,
          ...(context.requestHost ? { "x-forwarded-host": context.requestHost } : {}),
        },
      },
    ).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as {
      asOf?: string;
      days?: number;
      error?: string;
      visits?: number;
    };
    if (!response?.ok || typeof data.visits !== "number") {
      return {
        ok: false,
        message: data.error ?? "insights_visits_unavailable",
        status: response?.status ?? 503,
      };
    }
    return { ok: true, data, status: 200 };
  });
}
