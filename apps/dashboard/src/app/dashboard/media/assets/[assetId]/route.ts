import { deleteMerchantMedia, updateMerchantMedia } from "@/lib/merchant-media";
import { withMerchantAction } from "@/lib/platform-api/action-route";

type Context = { params: Promise<{ assetId: string }> };

export async function POST(request: Request, { params }: Context) {
  const { assetId } = await params;
  return withMerchantAction(request, async (context) => {
    const input = (await context.request.json().catch(() => ({}))) as {
      altText?: string | null;
      displayName?: string;
    };
    const result = await updateMerchantMedia(context, assetId, input);
    return result.ok
      ? { data: result.data, ok: true }
      : { message: result.error, ok: false, status: result.status };
  });
}

export async function DELETE(request: Request, { params }: Context) {
  const { assetId } = await params;
  return withMerchantAction(request, async (context) => {
    const result = await deleteMerchantMedia(context, assetId);
    return result.ok
      ? { data: result.data, ok: true }
      : { message: result.error, ok: false, status: result.status };
  });
}
