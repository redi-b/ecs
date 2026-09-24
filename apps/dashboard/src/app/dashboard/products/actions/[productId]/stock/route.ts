import { updateMerchantProductStock } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as {
      stockedQuantity?: unknown;
    };
    const stockedQuantity = getStockedQuantity(body.stockedQuantity);

    if (stockedQuantity === null) {
      return { ok: false, message: "invalid_stocked_quantity", status: 400 };
    }

    const result = await updateMerchantProductStock({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      productId,
      requestHost: context.requestHost,
      stockedQuantity,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { stock: result.stock } };
  });
}

function getStockedQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}
