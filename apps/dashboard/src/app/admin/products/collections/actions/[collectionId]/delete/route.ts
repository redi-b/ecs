import { deleteMerchantProductCollection } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const { collectionId } = await params;

  return withMerchantAction(request, async (context) => {
    const result = await deleteMerchantProductCollection({
      collectionId,
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { success: true, id: result.id } };
  });
}
