import { completeProductMediaUpload } from "@/lib/merchant-media";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;

  return withMerchantAction(request, async (context) => {
    const input = (await context.request.json().catch(() => ({}))) as {
      altText?: string | undefined;
      height?: number | undefined;
      width?: number | undefined;
    };
    const result = await completeProductMediaUpload(
      {
        cookieHeader: context.cookieHeader,
        platformApiBaseUrl: context.platformApiBaseUrl,
        requestHost: context.requestHost,
      },
      assetId,
      input,
    );

    return result.ok
      ? { data: result.data, ok: true }
      : { message: result.error, ok: false, status: result.status };
  });
}
