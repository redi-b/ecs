import { updateMerchantProductCategory } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;

  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      handle?: unknown;
      name?: unknown;
      parentCategoryId?: unknown;
      rank?: unknown;
      seoDescription?: unknown;
      seoTitle?: unknown;
      visibility?: unknown;
    };

    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
    if (!name) {
      return { ok: false, message: "missing_name", status: 400 };
    }

    const rank =
      typeof body.rank === "number" && Number.isFinite(body.rank)
        ? Math.max(0, Math.floor(body.rank))
        : typeof body.rank === "string" && body.rank.trim() && Number.isFinite(Number(body.rank))
          ? Math.max(0, Math.floor(Number(body.rank)))
          : undefined;

    const result = await updateMerchantProductCategory({
      categoryId,
      cookieHeader: context.cookieHeader,
      handle: typeof body.handle === "string" && body.handle.trim() ? body.handle.trim() : null,
      name,
      parentCategoryId:
        typeof body.parentCategoryId === "string" && body.parentCategoryId.trim()
          ? body.parentCategoryId.trim()
          : null,
      platformApiBaseUrl: context.platformApiBaseUrl,
      ...(rank === undefined ? {} : { rank }),
      requestHost: context.requestHost,
      seoDescription:
        typeof body.seoDescription === "string" ? body.seoDescription.trim() || null : null,
      seoTitle: typeof body.seoTitle === "string" ? body.seoTitle.trim() || null : null,
      tenantId: context.tenantId,
      visibility: body.visibility === "hidden" ? "hidden" : "public",
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { category: result.category } };
  });
}
