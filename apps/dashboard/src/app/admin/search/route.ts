import { getMerchantSearch } from "@/lib/merchant-search";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { withMerchantAction } from "@/lib/platform-api";

/**
 * Browser-facing search proxy for the command center.
 * Forwards cookies/host to Platform API aggregated merchant search.
 */
export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "6", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 12) : 6;
    const typesRaw = url.searchParams.get("types")?.trim();
    const types = typesRaw
      ? typesRaw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : undefined;

    const result = await getMerchantSearch({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      q,
      limit,
      types: types as Parameters<typeof getMerchantSearch>[0]["types"],
    });

    if (!result.ok) {
      return {
        ok: false,
        message: mapPlatformErrorMessage(result.message),
        status: result.status,
      };
    }

    return {
      ok: true,
      data: { results: result.results, query: result.query },
      status: 200,
    };
  });
}
