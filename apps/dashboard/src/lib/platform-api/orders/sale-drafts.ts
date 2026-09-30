import {
  type MerchantSaleDraft,
  type MerchantSaleDraftContent,
  type MerchantSaleDraftSummary,
  merchantSaleDraftSchema,
  merchantSaleDraftSummarySchema,
} from "@ecs/contracts";
import { z } from "zod";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

type RequestContext = {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
};

type DraftResult =
  | { ok: true; draft: MerchantSaleDraft }
  | { ok: false; message: string; status: number };

const listSchema = z.object({
  count: z.number().int().nonnegative(),
  drafts: z.array(merchantSaleDraftSummarySchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  ok: z.literal(true),
});

export async function listMerchantSaleDrafts(
  options: RequestContext & { limit?: number; offset?: number },
): Promise<
  | { ok: true; count: number; drafts: MerchantSaleDraftSummary[]; limit: number; offset: number }
  | { ok: false; message: string; status: number }
> {
  const url = new URL(
    "/platform/merchant/sale-drafts",
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
  url.searchParams.set("limit", String(options.limit ?? 20));
  url.searchParams.set("offset", String(options.offset ?? 0));
  const response = await (options.fetcher ?? fetch)(url, {
    cache: "no-store",
    headers: headersFor(options),
  }).catch(() => null);
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return failure(response, data, "sale_drafts_request_failed");
  const parsed = listSchema.safeParse(data);
  return parsed.success
    ? parsed.data
    : { ok: false, message: "invalid_sale_drafts_response", status: 502 };
}

export async function getMerchantSaleDraft(
  options: RequestContext & { draftId: string },
): Promise<DraftResult> {
  const response = await (options.fetcher ?? fetch)(draftUrl(options), {
    cache: "no-store",
    headers: headersFor(options),
  }).catch(() => null);
  return parseDraftResponse(response);
}

export async function saveMerchantSaleDraft(
  options: RequestContext & {
    content: MerchantSaleDraftContent;
    draftId?: string | undefined;
    expectedRevision?: number | undefined;
    idempotencyKey: string;
  },
): Promise<DraftResult> {
  const headers = headersFor(options, true);
  headers.set("idempotency-key", options.idempotencyKey);
  const response = await (options.fetcher ?? fetch)(
    options.draftId ? draftUrl({ ...options, draftId: options.draftId }) : draftsUrl(options),
    {
      body: JSON.stringify({ ...options.content, expectedRevision: options.expectedRevision }),
      cache: "no-store",
      headers,
      method: "POST",
    },
  ).catch(() => null);
  return parseDraftResponse(response);
}

export async function archiveMerchantSaleDraft(
  options: RequestContext & { draftId: string; idempotencyKey: string; revision: number },
) {
  const headers = headersFor(options, true);
  headers.set("idempotency-key", options.idempotencyKey);
  const response = await (options.fetcher ?? fetch)(draftUrl(options), {
    body: JSON.stringify({ revision: options.revision }),
    cache: "no-store",
    headers,
    method: "DELETE",
  }).catch(() => null);
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    return failure(response, data, "sale_draft_delete_failed");
  }
  return { ok: true as const };
}

function draftsUrl(options: RequestContext) {
  return new URL("/platform/merchant/sale-drafts", normalizeBaseUrl(options.platformApiBaseUrl));
}

function draftUrl(options: RequestContext & { draftId: string }) {
  return new URL(
    `/platform/merchant/sale-drafts/${encodeURIComponent(options.draftId)}`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
}

function headersFor(options: RequestContext, contentType = false) {
  return createPlatformHeaders({
    contentType: contentType ? "json" : false,
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}

async function parseDraftResponse(response: Response | null): Promise<DraftResult> {
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return failure(response, data, "sale_draft_request_failed");
  const parsed = z.object({ draft: merchantSaleDraftSchema }).safeParse(data);
  return parsed.success
    ? { ok: true, draft: parsed.data.draft }
    : { ok: false, message: "invalid_sale_draft_response", status: 502 };
}

function failure(response: Response, data: unknown, fallback: string) {
  const message =
    data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : fallback;
  return { ok: false as const, message, status: response.status };
}
