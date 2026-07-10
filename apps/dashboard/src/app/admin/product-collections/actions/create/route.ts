import { createMerchantProductCollection } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getTaxonomyFormInput } from "@/lib/taxonomy-form-data";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const collection = await getCollectionInput(context.request);

    if (!collection.title) {
      if (context.wantsJson) {
        return { ok: false, message: "missing_title", status: 400 };
      }

      return {
        ok: false,
        message: "missing_title",
        status: 400,
        redirectPath: "/admin/products/collections",
        redirectStatusParam: "missing_title",
      };
    }

    const result = await createMerchantProductCollection({
      cookieHeader: context.cookieHeader,
      handle: collection.handle,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
      title: collection.title,
    });

    if (!result.ok) {
      if (context.wantsJson) {
        return { ok: false, message: result.message, status: result.status };
      }

      return {
        ok: false,
        message: result.message,
        status: result.status,
        redirectPath: "/admin/products/collections",
        redirectStatusParam: result.message,
      };
    }

    if (context.wantsJson) {
      return { ok: true, data: { collection: result.collection } };
    }

    return {
      ok: true,
      data: { collection: result.collection },
      redirectPath: "/admin/products/collections",
      redirectStatusParam: "collection_created",
    };
  });
}

async function getCollectionInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      handle?: unknown;
      title?: unknown;
    };

    return {
      handle: typeof body.handle === "string" && body.handle.trim() ? body.handle.trim() : null,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
    };
  }

  return getTaxonomyFormInput(await request.formData());
}
