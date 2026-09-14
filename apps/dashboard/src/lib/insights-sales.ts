import { insightsSalesReportSchema, type InsightsSalesQuery } from "@ecs/contracts";
import {
  createPlatformHeaders,
  createPlatformUrl,
  getMerchantResourcePath,
  type PlatformRequestContext,
} from "./platform-api/client";
import { insightsProductsReportSchema, type InsightsProductsQuery } from "@ecs/contracts";
import { insightsStorefrontReportSchema, type InsightsStorefrontQuery } from "@ecs/contracts";
import { insightsDemandReportSchema, type InsightsDemandQuery } from "@ecs/contracts";

export async function getInsightsDemand(
  options: PlatformRequestContext & {
    tenantId?: string | null | undefined;
    query: InsightsDemandQuery;
    fetcher?: typeof fetch;
  },
) {
  const url = createPlatformUrl(
    getMerchantResourcePath("insights/demand", { tenantId: options.tenantId }),
    options.platformApiBaseUrl,
    options.query,
  );
  const response = await (options.fetcher ?? fetch)(url, {
    cache: "no-store",
    headers: createPlatformHeaders(options),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return { ok: false as const, status: response?.status ?? 503 };
  const parsed = insightsDemandReportSchema.safeParse(await response.json().catch(() => null));
  return parsed.success
    ? { ok: true as const, report: parsed.data }
    : { ok: false as const, status: 502 };
}

export async function getInsightsStorefront(
  options: PlatformRequestContext & {
    tenantId?: string | null | undefined;
    query: InsightsStorefrontQuery;
    fetcher?: typeof fetch;
  },
) {
  const url = createPlatformUrl(
    getMerchantResourcePath("insights/storefront", { tenantId: options.tenantId }),
    options.platformApiBaseUrl,
    options.query,
  );
  const response = await (options.fetcher ?? fetch)(url, {
    cache: "no-store",
    headers: createPlatformHeaders(options),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return { ok: false as const, status: response?.status ?? 503 };
  const parsed = insightsStorefrontReportSchema.safeParse(await response.json().catch(() => null));
  return parsed.success
    ? { ok: true as const, report: parsed.data }
    : { ok: false as const, status: 502 };
}

export async function getInsightsProducts(
  options: PlatformRequestContext & {
    tenantId?: string | null | undefined;
    query: InsightsProductsQuery;
    fetcher?: typeof fetch;
  },
) {
  const url = createPlatformUrl(
    getMerchantResourcePath("insights/products", { tenantId: options.tenantId }),
    options.platformApiBaseUrl,
    options.query,
  );
  const response = await (options.fetcher ?? fetch)(url, {
    cache: "no-store",
    headers: createPlatformHeaders(options),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return { ok: false as const, status: response?.status ?? 503 };
  const parsed = insightsProductsReportSchema.safeParse(await response.json().catch(() => null));
  return parsed.success
    ? { ok: true as const, report: parsed.data }
    : { ok: false as const, status: 502 };
}

export async function getInsightsSales(
  options: PlatformRequestContext & {
    tenantId?: string | null | undefined;
    query: InsightsSalesQuery;
    fetcher?: typeof fetch;
  },
) {
  const url = createPlatformUrl(
    getMerchantResourcePath("insights/sales", { tenantId: options.tenantId }),
    options.platformApiBaseUrl,
    options.query,
  );
  const response = await (options.fetcher ?? fetch)(url, {
    cache: "no-store",
    headers: createPlatformHeaders(options),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return { ok: false as const, status: response?.status ?? 503 };
  const parsed = insightsSalesReportSchema.safeParse(await response.json().catch(() => null));
  return parsed.success
    ? { ok: true as const, report: parsed.data }
    : { ok: false as const, status: 502 };
}
