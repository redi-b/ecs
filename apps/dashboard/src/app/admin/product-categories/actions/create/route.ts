import { createMerchantProductCategory } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getTaxonomyFormInput } from "@/lib/taxonomy-form-data";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const category = await getCategoryInput(context.request);

    if (!category.name) {
      if (context.wantsJson) {
        return { ok: false, message: "missing_name", status: 400 };
      }

      return {
        ok: false,
        message: "missing_name",
        status: 400,
        redirectPath: "/admin/products/categories",
        redirectStatusParam: "missing_name",
      };
    }

    const result = await createMerchantProductCategory({
      cookieHeader: context.cookieHeader,
      handle: category.handle,
      name: category.name,
      parentCategoryId: category.parentCategoryId,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
      visibility: category.visibility,
    });

    if (!result.ok) {
      if (context.wantsJson) {
        return { ok: false, message: result.message, status: result.status };
      }

      return {
        ok: false,
        message: result.message,
        status: result.status,
        redirectPath: "/admin/products/categories",
        redirectStatusParam: result.message,
      };
    }

    if (context.wantsJson) {
      return { ok: true, data: { category: result.category } };
    }

    return {
      ok: true,
      data: { category: result.category },
      redirectPath: "/admin/products/categories",
      redirectStatusParam: "category_created",
    };
  });
}

async function getCategoryInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      handle?: unknown;
      name?: unknown;
      parentCategoryId?: unknown;
      visibility?: unknown;
    };

    return {
      handle: typeof body.handle === "string" && body.handle.trim() ? body.handle.trim() : null,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
      parentCategoryId:
        typeof body.parentCategoryId === "string" && body.parentCategoryId.trim()
          ? body.parentCategoryId.trim()
          : null,
      visibility: body.visibility === "hidden" ? ("hidden" as const) : ("public" as const),
    };
  }

  const form = await getTaxonomyFormInput(await request.formData());
  return {
    ...form,
    parentCategoryId: null as string | null,
    visibility: "public" as const,
  };
}
