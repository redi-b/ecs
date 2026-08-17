import type { APIRoute } from "astro";

import { isStoreError } from "../../lib/commerce/result.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../lib/env.js";
import { submitStorefrontInquiry } from "../../lib/inquiries.js";

export const POST: APIRoute = async ({ request }) => {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const form = await request.formData();
  const type = String(form.get("type") ?? "");
  const returnTo = type === "product_request" ? "/request-item" : "/contact";

  const inquiry = type === "product_request"
    ? productRequestPayload(form)
    : type === "contact"
      ? contactPayload(form)
      : null;
  if (!inquiry) return failure(returnTo, "This inquiry type is not supported.", wantsJson, 400);

  const result = await submitStorefrontInquiry({
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
    inquiry,
  });
  if (isStoreError(result)) return failure(returnTo, result.message, wantsJson, result.status);

  if (wantsJson) {
    return Response.json({ inquiry: { id: result.id, createdAt: result.createdAt } }, { status: 201 });
  }
  const target = new URL(returnTo, request.url);
  target.searchParams.set("sent", "1");
  return Response.redirect(target, 303);
};

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function contactPayload(form: FormData) {
  const customerName = text(form, "fullName");
  const customerEmail = text(form, "email");
  const customerPhone = text(form, "whatsapp");
  const message = text(form, "message");
  return {
    type: "contact",
    customerName,
    customerEmail: customerEmail || null,
    customerPhone: customerPhone || null,
    subject: `Storefront inquiry from ${customerName || "a customer"}`,
    message,
    sourcePath: "/contact",
    website: text(form, "website"),
  };
}

function productRequestPayload(form: FormData) {
  const productName = text(form, "productName");
  const brand = text(form, "brand");
  const productUrl = text(form, "productUrl");
  const customerName = text(form, "customerName");
  const contact = text(form, "contact");
  const details = text(form, "details");
  const isEmail = contact.includes("@");
  return {
    type: "product_request",
    customerName,
    customerEmail: isEmail ? contact : null,
    customerPhone: isEmail ? null : contact,
    subject: `Product request: ${productName}`,
    message: details || `Customer requested ${productName}.`,
    sourcePath: "/request-item",
    website: text(form, "website"),
    details: { productName, brand, productUrl },
  };
}

function failure(returnTo: string, message: string, wantsJson: boolean, status: number) {
  if (wantsJson) return Response.json({ error: message }, { status });
  const target = new URL(returnTo, "http://local.invalid");
  target.searchParams.set("error", message);
  return new Response(null, { status: 303, headers: { Location: target.pathname + target.search } });
}
