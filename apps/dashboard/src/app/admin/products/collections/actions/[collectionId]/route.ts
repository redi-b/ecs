import { updateMerchantProductCollection } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const { collectionId } = await params;

  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      handle?: unknown;
      seoDescription?: unknown;
      seoTitle?: unknown;
      title?: unknown;
      visibility?: unknown;
    };

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
    if (!title) {
      return { ok: false, message: "missing_title", status: 400 };
    }

    const result = await updateMerchantProductCollection({
      collectionId,
      cookieHeader: context.cookieHeader,
      handle: typeof body.handle === "string" && body.handle.trim() ? body.handle.trim() : null,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      seoDescription:
        typeof body.seoDescription === "string" ? body.seoDescription.trim() || null : null,
      seoTitle: typeof body.seoTitle === "string" ? body.seoTitle.trim() || null : null,
      tenantId: context.tenantId,
      title,
      visibility: body.visibility === "hidden" ? "hidden" : "public",
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { collection: result.collection } };
  });
}
