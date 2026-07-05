import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { appendTenantRedirectParams } from "../../../../../lib/dashboard-tenant-context";
import { createMerchantProductCollection } from "../../../../../lib/merchant-products";
import { getTaxonomyFormInput } from "../../../../../lib/taxonomy-form-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const collection = getTaxonomyFormInput(formData);

  if (!collection.title) {
    return redirectToCollections(request, "missing_title");
  }

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await createMerchantProductCollection({
    cookieHeader: cookieStore.toString(),
    handle: collection.handle,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
    title: collection.title,
  });

  return redirectToCollections(request, result.ok ? "collection_created" : result.message);
}

function redirectToCollections(request: Request, status: string) {
  const url = new URL("/admin/products/collections", getRequestOrigin(request));

  url.searchParams.set("collectionStatus", status);
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
