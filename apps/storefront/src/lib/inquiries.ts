import { asError, isRecord, storeFetch } from "./commerce/http.js";
import type { HostedStoreRequest, StorefrontError } from "./commerce/types.js";

export type InquiryReceipt = { ok: true; id: string; createdAt: string };

export async function submitStorefrontInquiry(
  options: HostedStoreRequest & {
    inquiry: Record<string, unknown>;
  },
): Promise<InquiryReceipt | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/inquiries",
    method: "POST",
    body: options.inquiry,
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) return asError(response.status, data, "Could not send your message.");
  if (!isRecord(data) || !isRecord(data.inquiry)) {
    return asError(502, data, "The shop returned an invalid inquiry receipt.");
  }
  const id = typeof data.inquiry.id === "string" ? data.inquiry.id : "accepted";
  const createdAt = typeof data.inquiry.createdAt === "string" ? data.inquiry.createdAt : new Date().toISOString();
  return { ok: true, id, createdAt };
}
