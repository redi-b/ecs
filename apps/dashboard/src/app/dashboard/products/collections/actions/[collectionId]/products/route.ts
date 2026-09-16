import {
  getMerchantCollectionProducts,
  updateMerchantCollectionProducts,
} from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const { collectionId } = await params;

  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const result = await getMerchantCollectionProducts({
      collectionId,
      cookieHeader: context.cookieHeader,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: result.products };
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const { collectionId } = await params;

  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      add?: unknown;
      remove?: unknown;
    };
    const add = Array.isArray(body.add)
      ? body.add.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    const remove = Array.isArray(body.remove)
      ? body.remove.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    const result = await updateMerchantCollectionProducts({
      add,
      collectionId,
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      remove,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { ok: true } };
  });
}
