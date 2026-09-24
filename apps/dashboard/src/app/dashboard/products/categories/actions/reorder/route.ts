import { withMerchantAction } from "@/lib/platform-api/action-route";
import { reorderMerchantProductCategories } from "@/lib/merchant-products";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as { items?: unknown };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return { ok: false, message: "invalid_reorder_items", status: 400 };
    }

    const items: Array<{ categoryId: string; rank: number }> = [];
    for (const entry of body.items) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as { categoryId?: unknown; rank?: unknown };
      const categoryId =
        typeof record.categoryId === "string" && record.categoryId.trim()
          ? record.categoryId.trim()
          : null;
      const rank =
        typeof record.rank === "number" && Number.isFinite(record.rank)
          ? Math.max(0, Math.floor(record.rank))
          : null;
      if (!categoryId || rank === null) continue;
      items.push({ categoryId, rank });
    }

    if (!items.length) {
      return { ok: false, message: "invalid_reorder_items", status: 400 };
    }

    const result = await reorderMerchantProductCategories({
      cookieHeader: context.cookieHeader,
      items,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { ok: true } };
  });
}
