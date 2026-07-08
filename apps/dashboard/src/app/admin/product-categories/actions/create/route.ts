import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { appendTenantRedirectParams } from "../../../../../lib/dashboard-tenant-context";
import { createMerchantProductCategory } from "../../../../../lib/merchant-products";
import { getTaxonomyFormInput } from "../../../../../lib/taxonomy-form-data";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  const category = await getCategoryInput(request);

  if (!category.name) {
    if (wantsJson) {
      return NextResponse.json({ error: "missing_name" }, { status: 400 });
    }

    return redirectToCategories(request, "missing_name");
  }

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await createMerchantProductCategory({
    cookieHeader: cookieStore.toString(),
    handle: category.handle,
    name: category.name,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
  });

  if (wantsJson) {
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json({ category: result.category });
  }

  return redirectToCategories(request, result.ok ? "category_created" : result.message);
}

async function getCategoryInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      handle?: unknown;
      name?: unknown;
    };

    return {
      handle: typeof body.handle === "string" && body.handle.trim() ? body.handle.trim() : null,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
    };
  }

  return getTaxonomyFormInput(await request.formData());
}

function redirectToCategories(request: Request, status: string) {
  const url = new URL("/admin/products/categories", getRequestOrigin(request));

  url.searchParams.set("categoryStatus", status);
  appendTenantRedirectParams(url, request);

  return NextResponse.redirect(url, { status: 303 });
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}
