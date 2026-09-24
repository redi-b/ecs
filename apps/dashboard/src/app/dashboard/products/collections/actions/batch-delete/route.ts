import { deleteMerchantProductCollectionsBatch } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as {
      collectionIds?: unknown;
    };

    if (
      !body.collectionIds ||
      !Array.isArray(body.collectionIds) ||
      body.collectionIds.length === 0
    ) {
      return { ok: false, message: "invalid_collection_ids", status: 400 };
    }

    const collectionIds = body.collectionIds.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );

    if (collectionIds.length === 0) {
      return { ok: false, message: "invalid_collection_ids", status: 400 };
    }

    const result = await deleteMerchantProductCollectionsBatch({
      collectionIds,
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { success: true, ids: result.ids } };
  });
}
