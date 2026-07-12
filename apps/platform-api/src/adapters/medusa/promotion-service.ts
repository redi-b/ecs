import type {
  MerchantPromotion,
  MerchantPromotionDeleteResult,
  MerchantPromotionInput,
  MerchantPromotionResult,
  MerchantPromotionsResult,
} from "../../types/index.js";
import { getAdminHeaders } from "./product/medusa-http.js";

type Options = {
  adminApiToken?: string | undefined;
  medusaInternalUrl: string;
  fetcher?: typeof fetch | undefined;
};

export function createMedusaPromotionService(options: Options) {
  const fetcher = options.fetcher ?? fetch;
  const base = options.medusaInternalUrl.replace(/\/$/, "");
  const headers = () => getAdminHeaders(options.adminApiToken ?? "");
  const fail = (response?: Response | null) => ({
    error:
      response?.status === 401 ? "commerce_credentials_invalid" : "commerce_backend_unavailable",
    ok: false as const,
    status: response?.status === 401 ? 401 : 503,
  });

  async function listPromotions(input: {
    limit: number;
    offset: number;
    query?: string | undefined;
    tenantId: string;
  }): Promise<MerchantPromotionsResult> {
    const search = new URLSearchParams({
      fields: "+metadata,+application_method,+campaign",
      limit: "100",
      offset: "0",
    });
    if (input.query) search.set("q", input.query);
    const response = await fetcher(`${base}/admin/promotions?${search}`, {
      headers: headers(),
    }).catch(() => null);
    if (!response?.ok) return fail(response);
    const data = toRecord(await response.json().catch(() => ({})));
    const all = (Array.isArray(data.promotions) ? data.promotions : [])
      .filter((item) => getTenantId(item) === input.tenantId)
      .map(normalizePromotion);
    return {
      count: all.length,
      limit: input.limit,
      offset: input.offset,
      ok: true,
      promotions: all.slice(input.offset, input.offset + input.limit),
    };
  }

  async function getOwned(id: string, tenantId: string): Promise<MerchantPromotionResult> {
    const response = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(id)}?fields=+metadata,+application_method,+campaign`,
      { headers: headers() },
    ).catch(() => null);
    if (!response?.ok)
      return response?.status === 404
        ? { error: "promotion_not_found", ok: false, status: 404 }
        : fail(response);
    const raw = (await response.json().catch(() => ({}))).promotion;
    return raw?.metadata?.platform_tenant_id === tenantId
      ? { ok: true, promotion: normalizePromotion(raw) }
      : { error: "promotion_not_found", ok: false, status: 404 };
  }

  async function createPromotion(input: MerchantPromotionInput): Promise<MerchantPromotionResult> {
    const response = await fetcher(`${base}/admin/promotions`, {
      body: JSON.stringify(toPayload(input)),
      headers: headers(),
      method: "POST",
    }).catch(() => null);
    return response?.ok
      ? {
          ok: true,
          promotion: normalizePromotion((await response.json().catch(() => ({}))).promotion),
        }
      : fail(response);
  }

  async function updatePromotion(
    input: MerchantPromotionInput & { promotionId: string },
  ): Promise<MerchantPromotionResult> {
    const owned = await getOwned(input.promotionId, input.tenantId);
    if (!owned.ok) return owned;
    const response = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(input.promotionId)}`,
      { body: JSON.stringify(toPayload(input)), headers: headers(), method: "POST" },
    ).catch(() => null);
    return response?.ok
      ? {
          ok: true,
          promotion: normalizePromotion((await response.json().catch(() => ({}))).promotion),
        }
      : fail(response);
  }

  async function deletePromotion(input: {
    promotionId: string;
    tenantId: string;
  }): Promise<MerchantPromotionDeleteResult> {
    const owned = await getOwned(input.promotionId, input.tenantId);
    if (!owned.ok) return owned;
    const response = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(input.promotionId)}`,
      { headers: headers(), method: "DELETE" },
    ).catch(() => null);
    return response?.ok ? { deleted: true, id: input.promotionId, ok: true } : fail(response);
  }
  return { createPromotion, deletePromotion, listPromotions, updatePromotion };
}

function toPayload(input: MerchantPromotionInput) {
  return {
    application_method: {
      allocation: "across",
      currency_code:
        input.method === "fixed" ? (input.currencyCode ?? "etb").toLowerCase() : undefined,
      target_type: "items",
      type: input.method,
      value: input.value,
    },
    code: input.code.trim().toUpperCase(),
    ends_at: input.endsAt || null,
    is_automatic: false,
    metadata: { platform_tenant_id: input.tenantId },
    starts_at: input.startsAt || null,
    status: input.status,
    type: "standard",
    usage_limit: input.usageLimit ?? null,
  };
}

function normalizePromotion(value: unknown): MerchantPromotion {
  const promotion = toRecord(value);
  const method = toRecord(promotion.application_method);
  return {
    code: String(promotion.code ?? ""),
    createdAt: stringOr(promotion.created_at, new Date(0).toISOString()),
    currencyCode: stringOrNull(method.currency_code),
    endsAt: stringOrNull(promotion.ends_at),
    id: String(promotion.id ?? ""),
    method: method.type === "fixed" ? "fixed" : "percentage",
    startsAt: stringOrNull(promotion.starts_at),
    status:
      promotion.status === "active" || promotion.status === "inactive" ? promotion.status : "draft",
    updatedAt: stringOr(
      promotion.updated_at,
      stringOr(promotion.created_at, new Date(0).toISOString()),
    ),
    usageCount: Number(promotion.usage_count ?? 0),
    usageLimit: promotion.usage_limit == null ? null : Number(promotion.usage_limit),
    value: Number(method.value ?? 0),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}
function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}
function getTenantId(value: unknown) {
  return stringOrNull(toRecord(toRecord(value).metadata).platform_tenant_id);
}
