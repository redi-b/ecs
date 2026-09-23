import { createMerchantProduct } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getProductFormInput } from "@/lib/product-form-data";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const product = await getProductInput(context.request);

    if (!product.title) {
      if (context.wantsJson) {
        return {
          ok: false,
          message: "A product title is required before saving.",
          status: 400,
        };
      }

      return {
        ok: false,
        message: "missing_title",
        status: 400,
        redirectPath: "/dashboard/products",
        redirectStatusParam: "missing_title",
      };
    }

    const result = await createMerchantProduct({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      product,
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
        redirectPath: "/dashboard/products",
        redirectStatusParam: result.message,
      };
    }

    if (context.wantsJson) {
      return { ok: true, data: { product: result.product, mediaSyncWarning: result.mediaSyncWarning } };
    }

    return {
      ok: true,
      data: { product: result.product, mediaSyncWarning: result.mediaSyncWarning },
      redirectPath: "/dashboard/products",
      redirectStatusParam: "product_created",
    };
  });
}

async function getProductInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as ReturnType<typeof getProductFormInput>;
  }

  return getProductFormInput(await request.formData());
}
