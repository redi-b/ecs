import { getMerchantCustomers } from "@/lib/merchant-customers";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const query = url.searchParams.get("q")?.trim() || undefined;

    const result = await getMerchantCustomers({
      cookieHeader: context.cookieHeader,
      limit: Number.isFinite(limit) ? Math.min(limit, 100) : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      ...(query ? { query } : {}),
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: result.customers };
  });
}
