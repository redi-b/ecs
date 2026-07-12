import { getMerchantMedia } from "@/lib/merchant-media";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(context.request.url);
    const query = url.searchParams.get("q")?.trim();
    const mimeType = url.searchParams.get("mimeType")?.trim();
    const limit = parseInteger(url.searchParams.get("limit"), 24, 1, 100);
    const offset = parseInteger(url.searchParams.get("offset"), 0, 0, 100_000);
    const result = await getMerchantMedia(
      {
        cookieHeader: context.cookieHeader,
        platformApiBaseUrl: context.platformApiBaseUrl,
        requestHost: context.requestHost,
      },
      {
        limit,
        offset,
        ...(query ? { query } : {}),
        ...(mimeType && mimeType !== "all" ? { mimeType } : {}),
      },
    );
    return result.ok
      ? { data: result.data, ok: true }
      : { message: result.error, ok: false, status: result.status };
  });
}

function parseInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
