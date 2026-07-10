import { updateMerchantProduct } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getProductFormInput } from "@/lib/product-form-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  return withMerchantAction(request, async (context) => {
    const product = await getProductInput(context.request);
    const result = await updateMerchantProduct({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      product,
      productId,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      if (context.wantsJson) {
        return { ok: false, message: result.message, status: result.status };
      }

      return {
        ok: false,
        message: result.message,
        status: result.status,
        redirectPath: "/admin/products",
        redirectStatusParam: result.message,
      };
    }

    if (context.wantsJson) {
      return { ok: true, data: { product: result.product } };
    }

    return {
      ok: true,
      data: { product: result.product },
      redirectPath: "/admin/products",
      redirectStatusParam: "product_updated",
    };
  });
}

async function getProductInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as ReturnType<typeof getProductFormInput>;
  }

  return getProductFormInput(await request.formData());
}
