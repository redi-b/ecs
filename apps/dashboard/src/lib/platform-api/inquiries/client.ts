import { createPlatformHeaders, createPlatformUrl, getMerchantResourcePath } from "@/lib/platform-api/client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

export type StorefrontInquiryStatus = "new" | "read" | "resolved" | "archived";
export type StorefrontInquiry = {
  id: string;
  type: "contact" | "product_request";
  status: StorefrontInquiryStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  subject: string;
  message: string;
  details: Record<string, string>;
  sourcePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StorefrontInquiriesResult =
  | { ok: true; inquiries: StorefrontInquiry[]; count: number; limit: number; offset: number }
  | { ok: false; message: string; status: number };

type RequestOptions = {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
};

export async function getStorefrontInquiries(options: RequestOptions & { limit: number; offset: number; q?: string | undefined; status?: string | undefined; type?: string | undefined }): Promise<StorefrontInquiriesResult> {
  const path = getMerchantResourcePath("inquiries", { tenantId: options.tenantId });
  const url = createPlatformUrl(path, options.platformApiBaseUrl, { limit: options.limit, offset: options.offset, q: options.q, status: options.status, type: options.type });
  const response = await (options.fetcher ?? fetch)(url, { cache: "no-store", headers: createPlatformHeaders({ cookieHeader: options.cookieHeader, requestHost: options.tenantId ? undefined : options.requestHost }) }).catch(() => null);
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, message: mapPlatformErrorMessage(typeof data.error === "string" ? data.error : null, { fallback: "Inquiries are temporarily unavailable." }), status: response.status };
  if (!Array.isArray(data.inquiries) || typeof data.count !== "number") return { ok: false, message: "invalid_inquiries_response", status: 502 };
  return { ok: true, inquiries: data.inquiries as StorefrontInquiry[], count: data.count, limit: Number(data.limit) || options.limit, offset: Number(data.offset) || options.offset };
}

export async function updateStorefrontInquiryStatus(options: RequestOptions & { inquiryId: string; status: StorefrontInquiryStatus }) {
  const path = getMerchantResourcePath("inquiries", { id: options.inquiryId, tenantId: options.tenantId });
  const response = await (options.fetcher ?? fetch)(createPlatformUrl(path, options.platformApiBaseUrl), {
    method: "PATCH",
    headers: createPlatformHeaders({ contentType: "json", cookieHeader: options.cookieHeader, requestHost: options.tenantId ? undefined : options.requestHost }),
    body: JSON.stringify({ status: options.status }),
  }).catch(() => null);
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false as const, message: mapPlatformErrorMessage(typeof data.error === "string" ? data.error : null, { fallback: "Could not update this inquiry." }), status: response.status };
  return { ok: true as const, inquiry: data.inquiry as StorefrontInquiry };
}
