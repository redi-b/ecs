import { getMediaUploadConfig } from "@/lib/merchant-media";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => ({
    data: await getMediaUploadConfig({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    }),
    ok: true,
    status: 200,
  }));
}
