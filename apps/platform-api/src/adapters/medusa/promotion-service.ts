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

/** Prefix campaign identifiers so promotions stay tenant-scoped without metadata. */
function tenantCampaignPrefix(tenantId: string) {
  return `ecs_${tenantId}_`;
}

function tenantCampaignIdentifier(tenantId: string, code: string) {
  const slug = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${tenantCampaignPrefix(tenantId)}${slug || "PROMO"}`;
}

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

  function isOwnedByTenant(raw: unknown, tenantId: string) {
    const promotion = toRecord(raw);
    const campaign = toRecord(promotion.campaign);
    const identifier = stringOrNull(campaign.campaign_identifier);
    if (identifier?.startsWith(tenantCampaignPrefix(tenantId))) return true;
    // Legacy: earlier payloads attempted metadata tenancy (not supported by Medusa).
    const metadata = toRecord(promotion.metadata);
    return stringOrNull(metadata.platform_tenant_id) === tenantId;
  }

  async function listPromotions(input: {
    limit: number;
    offset: number;
    query?: string | undefined;
    tenantId: string;
  }): Promise<MerchantPromotionsResult> {
    const search = new URLSearchParams({
      fields: "+application_method,+campaign",
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
      .filter((item) => isOwnedByTenant(item, input.tenantId))
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
      `${base}/admin/promotions/${encodeURIComponent(id)}?fields=+application_method,+campaign`,
      { headers: headers() },
    ).catch(() => null);
    if (!response?.ok)
      return response?.status === 404
        ? { error: "promotion_not_found", ok: false, status: 404 }
        : fail(response);
    const raw = (await response.json().catch(() => ({}))).promotion;
    return isOwnedByTenant(raw, tenantId)
      ? { ok: true, promotion: normalizePromotion(raw) }
      : { error: "promotion_not_found", ok: false, status: 404 };
  }

  async function createPromotion(input: MerchantPromotionInput): Promise<MerchantPromotionResult> {
    const response = await fetcher(`${base}/admin/promotions`, {
      body: JSON.stringify(toCreatePayload(input)),
      headers: headers(),
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) return fail(response);
    return {
      ok: true,
      promotion: normalizePromotion((await response.json().catch(() => ({}))).promotion),
    };
  }

  async function updatePromotion(
    input: MerchantPromotionInput & { promotionId: string },
  ): Promise<MerchantPromotionResult> {
    const owned = await getOwned(input.promotionId, input.tenantId);
    if (!owned.ok) return owned;

    const response = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(input.promotionId)}`,
      { body: JSON.stringify(toUpdatePayload(input)), headers: headers(), method: "POST" },
    ).catch(() => null);
    if (!response?.ok) return fail(response);

    // Schedule is stored on the campaign, not the promotion.
    const detailResponse = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(input.promotionId)}?fields=+campaign`,
      { headers: headers() },
    ).catch(() => null);
    if (detailResponse?.ok) {
      const promo = toRecord((await detailResponse.json().catch(() => ({}))).promotion);
      const campaign = toRecord(promo.campaign);
      const campaignId = stringOrNull(campaign.id) ?? stringOrNull(promo.campaign_id);
      if (campaignId && (input.startsAt !== undefined || input.endsAt !== undefined)) {
        await fetcher(`${base}/admin/campaigns/${encodeURIComponent(campaignId)}`, {
          body: JSON.stringify({
            ...(input.startsAt !== undefined ? { starts_at: input.startsAt || null } : {}),
            ...(input.endsAt !== undefined ? { ends_at: input.endsAt || null } : {}),
          }),
          headers: headers(),
          method: "POST",
        }).catch(() => null);
      }
    }

    return getOwned(input.promotionId, input.tenantId);
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

/**
 * Medusa AdminCreatePromotion accepts code/type/status/limit/application_method/campaign.
 * Schedule lives on campaign; usage cap is `limit` (not usage_limit). No top-level metadata.
 */
function toCreatePayload(input: MerchantPromotionInput) {
  const code = input.code.trim().toUpperCase();
  const targetType = input.targetType ?? "order";
  const application_method: Record<string, unknown> = {
    type: input.method,
    target_type: targetType,
    value: input.value,
  };
  if (input.method === "fixed") {
    application_method.currency_code = (input.currencyCode ?? "etb").toLowerCase();
  }
  // Allocation is only relevant when the discount applies across cart line items.
  if (targetType === "items") {
    application_method.allocation = input.allocation ?? "across";
  }

  return {
    application_method,
    campaign: {
      campaign_identifier: tenantCampaignIdentifier(input.tenantId, code),
      ends_at: input.endsAt || null,
      name: code,
      starts_at: input.startsAt || null,
    },
    code,
    is_automatic: input.isAutomatic ?? false,
    ...(input.usageLimit != null ? { limit: input.usageLimit } : {}),
    status: input.status,
    type: input.promotionType ?? "standard",
  };
}

function toUpdatePayload(input: MerchantPromotionInput) {
  const code = input.code.trim().toUpperCase();
  const targetType = input.targetType ?? "order";
  const application_method: Record<string, unknown> = {
    type: input.method,
    target_type: targetType,
    value: input.value,
  };
  if (input.method === "fixed") {
    application_method.currency_code = (input.currencyCode ?? "etb").toLowerCase();
  }
  if (targetType === "items") {
    application_method.allocation = input.allocation ?? "across";
  }

  return {
    application_method,
    code,
    is_automatic: input.isAutomatic ?? false,
    limit: input.usageLimit ?? null,
    status: input.status,
    type: input.promotionType ?? "standard",
  };
}

function normalizePromotion(value: unknown): MerchantPromotion {
  const promotion = toRecord(value);
  const method = toRecord(promotion.application_method);
  const campaign = toRecord(promotion.campaign);
  return {
    code: String(promotion.code ?? ""),
    createdAt: stringOr(promotion.created_at, new Date(0).toISOString()),
    currencyCode: stringOrNull(method.currency_code),
    endsAt: stringOrNull(campaign.ends_at) ?? stringOrNull(promotion.ends_at),
    id: String(promotion.id ?? ""),
    isAutomatic: Boolean(promotion.is_automatic),
    method: method.type === "fixed" ? "fixed" : "percentage",
    promotionType: promotion.type === "buyget" ? "buyget" : "standard",
    startsAt: stringOrNull(campaign.starts_at) ?? stringOrNull(promotion.starts_at),
    status:
      promotion.status === "active" || promotion.status === "inactive" ? promotion.status : "draft",
    targetType:
      method.target_type === "items" || method.target_type === "shipping_methods"
        ? method.target_type
        : "order",
    updatedAt: stringOr(
      promotion.updated_at,
      stringOr(promotion.created_at, new Date(0).toISOString()),
    ),
    usageCount: Number(promotion.used ?? promotion.usage_count ?? 0),
    usageLimit:
      promotion.limit == null && promotion.usage_limit == null
        ? null
        : Number(promotion.limit ?? promotion.usage_limit),
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
