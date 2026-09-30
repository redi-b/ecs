import {
  type MerchantOperationsDocumentKind,
  merchantOperationsDocumentsResponseSchema,
} from "@ecs/contracts";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

export async function getMerchantDocuments(options: {
  cookieHeader?: string | null;
  from?: string;
  kind?: MerchantOperationsDocumentKind;
  limit?: number;
  offset?: number;
  platformApiBaseUrl: string;
  q?: string;
  requestHost?: string | null;
  to?: string;
}) {
  const url = new URL("/platform/merchant/documents", normalizeBaseUrl(options.platformApiBaseUrl));
  url.searchParams.set("limit", String(options.limit ?? 20));
  url.searchParams.set("offset", String(options.offset ?? 0));
  if (options.q) url.searchParams.set("q", options.q);
  if (options.kind) url.searchParams.set("kind", options.kind);
  if (options.from) url.searchParams.set("from", options.from);
  if (options.to) url.searchParams.set("to", options.to);
  const response = await fetch(url, {
    cache: "no-store",
    headers: createPlatformHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.requestHost,
    }),
  }).catch(() => null);
  if (!response) return { message: "platform_request_failed", ok: false as const, status: 503 };
  const body = await response.json().catch(() => undefined);
  const parsed = merchantOperationsDocumentsResponseSchema.safeParse(body);
  return response.ok && parsed.success
    ? { data: parsed.data, ok: true as const }
    : {
        message: typeof body?.error === "string" ? body.error : "documents_request_failed",
        ok: false as const,
        status: response.status || 502,
      };
}
