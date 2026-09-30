import {
  type MerchantQuotation,
  type MerchantQuotationRevision,
  type MerchantQuotationSummary,
  merchantQuotationRevisionSchema,
  merchantQuotationSchema,
  merchantQuotationSummarySchema,
} from "@ecs/contracts";
import { z } from "zod";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

type Context = {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
};
const listSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  ok: z.literal(true),
  quotations: z.array(merchantQuotationSummarySchema),
});

export async function listMerchantQuotations(
  options: Context & { limit?: number; offset?: number },
): Promise<
  | {
      ok: true;
      count: number;
      limit: number;
      offset: number;
      quotations: MerchantQuotationSummary[];
    }
  | { ok: false; message: string; status: number }
> {
  const url = quotationsUrl(options);
  url.searchParams.set("limit", String(options.limit ?? 20));
  url.searchParams.set("offset", String(options.offset ?? 0));
  const response = await (options.fetcher ?? fetch)(url, {
    cache: "no-store",
    headers: headersFor(options),
  }).catch(() => null);
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return failure(response, data);
  const parsed = listSchema.safeParse(data);
  return parsed.success
    ? parsed.data
    : { ok: false, message: "invalid_quotations_response", status: 502 };
}

export async function getMerchantQuotation(
  options: Context & { quotationId: string },
): Promise<
  | { ok: true; quotation: MerchantQuotation; revisions: MerchantQuotationRevision[] }
  | { ok: false; message: string; status: number }
> {
  const response = await (options.fetcher ?? fetch)(quotationUrl(options), {
    cache: "no-store",
    headers: headersFor(options),
  }).catch(() => null);
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return failure(response, data);
  const parsed = z
    .object({
      quotation: merchantQuotationSchema,
      revisions: z.array(merchantQuotationRevisionSchema),
    })
    .safeParse(data);
  return parsed.success
    ? { ok: true, ...parsed.data }
    : { ok: false, message: "invalid_quotation_response", status: 502 };
}

export async function issueMerchantQuotation(
  options: Context & { draftId: string; idempotencyKey: string; language: "en" | "am" },
) {
  const headers = headersFor(options, true);
  headers.set("idempotency-key", options.idempotencyKey);
  const response = await (options.fetcher ?? fetch)(quotationsUrl(options), {
    body: JSON.stringify({ draftId: options.draftId, language: options.language }),
    cache: "no-store",
    headers,
    method: "POST",
  }).catch(() => null);
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return failure(response, data);
  const parsed = z.object({ quotation: merchantQuotationSchema }).safeParse(data);
  return parsed.success
    ? { ok: true as const, quotation: parsed.data.quotation }
    : { ok: false as const, message: "invalid_quotation_response", status: 502 };
}

export async function reviseMerchantQuotation(
  options: Context & {
    draftId: string;
    expectedRevision: number;
    idempotencyKey: string;
    language: "en" | "am";
    quotationId: string;
  },
) {
  const headers = headersFor(options, true);
  headers.set("idempotency-key", options.idempotencyKey);
  const response = await (options.fetcher ?? fetch)(
    new URL(
      `/platform/merchant/quotations/${encodeURIComponent(options.quotationId)}/revisions`,
      normalizeBaseUrl(options.platformApiBaseUrl),
    ),
    {
      body: JSON.stringify({
        draftId: options.draftId,
        expectedRevision: options.expectedRevision,
        language: options.language,
      }),
      cache: "no-store",
      headers,
      method: "POST",
    },
  ).catch(() => null);
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return failure(response, data);
  const parsed = z.object({ quotation: merchantQuotationSchema }).safeParse(data);
  return parsed.success
    ? { ok: true as const, quotation: parsed.data.quotation }
    : { ok: false as const, message: "invalid_quotation_response", status: 502 };
}

export async function convertMerchantQuotation(
  options: Context & { confirmChanges: boolean; idempotencyKey: string; quotationId: string },
) {
  const headers = headersFor(options, true);
  headers.set("idempotency-key", options.idempotencyKey);
  const response = await (options.fetcher ?? fetch)(
    new URL(
      `/platform/merchant/quotations/${encodeURIComponent(options.quotationId)}/convert`,
      normalizeBaseUrl(options.platformApiBaseUrl),
    ),
    {
      body: JSON.stringify({ confirmChanges: options.confirmChanges }),
      cache: "no-store",
      headers,
      method: "POST",
    },
  ).catch(() => null);
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const data = (await response.json().catch(() => undefined)) as
    | { order?: { id?: string }; conflicts?: unknown }
    | undefined;
  if (!response.ok) return { ...failure(response, data), conflicts: data?.conflicts };
  return data?.order?.id
    ? { ok: true as const, orderId: data.order.id }
    : { ok: false as const, message: "invalid_quotation_conversion_response", status: 502 };
}

function quotationsUrl(options: Context) {
  return new URL("/platform/merchant/quotations", normalizeBaseUrl(options.platformApiBaseUrl));
}
function quotationUrl(options: Context & { quotationId: string }) {
  return new URL(
    `/platform/merchant/quotations/${encodeURIComponent(options.quotationId)}`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
}
function headersFor(options: Context, json = false) {
  return createPlatformHeaders({
    contentType: json ? "json" : false,
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}
function failure(response: Response, data: unknown) {
  const message =
    data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : "quotation_request_failed";
  return { ok: false as const, message, status: response.status };
}
