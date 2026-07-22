import type {
  MerchantPromotion,
  MerchantPromotionDeleteResult,
  MerchantPromotionInput,
  MerchantPromotionResult,
  MerchantPromotionsResult,
} from "../../types/index.js";
import { mapMedusaFailure } from "./map-medusa-failure.js";
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
  /** Map Medusa failures; validation stays 4xx (never collapse to 503). */
  function promotionFailure(response?: Response | null) {
    return mapMedusaFailure(response, {
      invalidError: "invalid_promotion",
      notFoundError: "promotion_not_found",
      refine: ({ blob }) => {
        if (blob.includes("max_quantity")) {
          return { error: "promotion_max_quantity_required", status: 400 };
        }
        if (blob.includes("currency")) {
          return { error: "promotion_currency_required", status: 400 };
        }
        if (blob.includes("code") && (blob.includes("unique") || blob.includes("exist"))) {
          return { error: "promotion_code_taken", status: 400 };
        }
        return null;
      },
    });
  }

  function isOwnedByTenant(raw: unknown, tenantId: string) {
    const promotion = toRecord(raw);
    const campaign = toRecord(promotion.campaign);
    const identifier = stringOrNull(campaign.campaign_identifier);
    if (identifier?.startsWith(tenantCampaignPrefix(tenantId))) return true;
    const metadata = toRecord(promotion.metadata);
    return stringOrNull(metadata.platform_tenant_id) === tenantId;
  }

  async function listPromotions(input: {
    limit: number;
    offset: number;
    query?: string | undefined;
    /** Main status filter; applied after tenant ownership (Medusa list is not tenant-scoped). */
    status?: "active" | "inactive" | "draft" | undefined;
    tenantId: string;
  }): Promise<MerchantPromotionsResult> {
    const search = new URLSearchParams({
      fields: "+application_method,+application_method.target_rules,+application_method.buy_rules,+campaign,+rules",
      limit: "100",
      offset: "0",
    });
    if (input.query) search.set("q", input.query);
    const response = await fetcher(`${base}/admin/promotions?${search}`, {
      headers: headers(),
    }).catch(() => null);
    if (!response?.ok) return promotionFailure(response);
    const data = toRecord(await response.json().catch(() => ({})));
    const all = (Array.isArray(data.promotions) ? data.promotions : [])
      .filter((item) => isOwnedByTenant(item, input.tenantId))
      .map(normalizePromotion)
      .filter((item) => !input.status || item.status === input.status);
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
      `${base}/admin/promotions/${encodeURIComponent(id)}?fields=+application_method,+application_method.target_rules,+application_method.buy_rules,+campaign,+rules`,
      { headers: headers() },
    ).catch(() => null);
    if (!response?.ok) return promotionFailure(response);
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
    if (!response?.ok) return promotionFailure(response);
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
    if (!response?.ok) return promotionFailure(response);

    const detailResponse = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(input.promotionId)}?fields=+campaign`,
      { headers: headers() },
    ).catch(() => null);
    if (detailResponse?.ok) {
      const promo = toRecord((await detailResponse.json().catch(() => ({}))).promotion);
      const campaign = toRecord(promo.campaign);
      const campaignId = stringOrNull(campaign.id) ?? stringOrNull(promo.campaign_id);
      if (
        campaignId &&
        (input.startsAt !== undefined ||
          input.endsAt !== undefined ||
          input.campaignName !== undefined ||
          input.campaignBudgetType !== undefined ||
          input.campaignBudgetLimit !== undefined)
      ) {
        await fetcher(`${base}/admin/campaigns/${encodeURIComponent(campaignId)}`, {
          body: JSON.stringify(toCampaignUpdate(input)),
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
    return response?.ok
      ? { deleted: true, id: input.promotionId, ok: true }
      : promotionFailure(response);
  }

  return { createPromotion, deletePromotion, listPromotions, updatePromotion };
}

function productRule(productIds: string[]) {
  const ids = productIds.map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return undefined;
  return {
    attribute: "items.product.id",
    operator: "in" as const,
    values: ids,
  };
}

function toCreatePayload(input: MerchantPromotionInput) {
  const code = input.code.trim().toUpperCase();
  const promotionType = input.promotionType ?? "standard";
  const targetType = input.targetType ?? "order";
  const productIds = input.productIds ?? [];
  const buyProductIds = input.buyProductIds ?? [];

  const application_method: Record<string, unknown> = {
    type: input.method,
    target_type: targetType,
    value: input.value,
  };

  if (input.method === "fixed" || targetType === "order") {
    // Fixed discounts require currency; order-level fixed also needs it.
    if (input.method === "fixed") {
      application_method.currency_code = (input.currencyCode ?? "etb").toLowerCase();
    }
  }

  if (targetType === "items" || promotionType === "buyget") {
    const allocation = input.allocation ?? "each";
    application_method.allocation = allocation;
    // Medusa requires max_quantity when allocation is each/once.
    if (allocation === "each") {
      application_method.max_quantity = input.maxQuantity ?? 1;
    } else if (input.maxQuantity != null) {
      application_method.max_quantity = input.maxQuantity;
    }
  } else if (input.maxQuantity != null) {
    application_method.max_quantity = input.maxQuantity;
  }

  const targetRule = productRule(productIds);
  if (targetRule) {
    application_method.target_rules = [targetRule];
  }

  if (promotionType === "buyget") {
    application_method.buy_rules_min_quantity = input.buyMinQuantity ?? 1;
    application_method.apply_to_quantity = input.applyToQuantity ?? 1;
    const buyRule = productRule(buyProductIds.length ? buyProductIds : productIds);
    if (buyRule) {
      application_method.buy_rules = [buyRule];
    }
    // Buy X get Y is typically free (100% off the get items).
    application_method.type = "percentage";
    application_method.value = 100;
    application_method.target_type = "items";
    const allocation = input.allocation ?? "each";
    application_method.allocation = allocation;
    if (allocation === "each") {
      application_method.max_quantity = input.maxQuantity ?? 1;
    } else if (input.maxQuantity != null) {
      application_method.max_quantity = input.maxQuantity;
    }
  }

  const campaignName = input.campaignName?.trim() || code;
  const campaign: Record<string, unknown> = {
    campaign_identifier: tenantCampaignIdentifier(input.tenantId, code),
    ends_at: input.endsAt || null,
    name: campaignName,
    starts_at: input.startsAt || null,
  };

  if (input.campaignBudgetType && input.campaignBudgetLimit != null) {
    campaign.budget = {
      type: input.campaignBudgetType,
      limit: input.campaignBudgetLimit,
      ...(input.campaignBudgetType === "spend"
        ? { currency_code: (input.currencyCode ?? "etb").toLowerCase() }
        : {}),
    };
  }

  return {
    application_method,
    campaign,
    code,
    is_automatic: input.isAutomatic ?? false,
    is_tax_inclusive: input.isTaxInclusive ?? false,
    ...(input.usageLimit != null ? { limit: input.usageLimit } : {}),
    status: input.status,
    type: promotionType,
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
    const allocation = input.allocation ?? "each";
    application_method.allocation = allocation;
    if (allocation === "each") {
      application_method.max_quantity =
        input.maxQuantity !== undefined && input.maxQuantity != null
          ? input.maxQuantity
          : 1;
    } else if (input.maxQuantity !== undefined && input.maxQuantity != null) {
      application_method.max_quantity = input.maxQuantity;
    }
  } else if (input.maxQuantity !== undefined && input.maxQuantity != null) {
    application_method.max_quantity = input.maxQuantity;
  }

  return {
    application_method,
    code,
    is_automatic: input.isAutomatic ?? false,
    is_tax_inclusive: input.isTaxInclusive ?? false,
    limit: input.usageLimit ?? null,
    status: input.status,
    type: input.promotionType ?? "standard",
  };
}

function toCampaignUpdate(input: MerchantPromotionInput) {
  const body: Record<string, unknown> = {};
  if (input.startsAt !== undefined) body.starts_at = input.startsAt || null;
  if (input.endsAt !== undefined) body.ends_at = input.endsAt || null;
  if (input.campaignName !== undefined) body.name = input.campaignName?.trim() || undefined;
  if (input.campaignBudgetType && input.campaignBudgetLimit != null) {
    body.budget = { limit: input.campaignBudgetLimit };
  }
  return body;
}

function ruleProductIds(rules: unknown): string[] {
  if (!Array.isArray(rules)) return [];
  const ids: string[] = [];
  for (const rule of rules) {
    const record = toRecord(rule);
    const attribute = stringOrNull(record.attribute) ?? "";
    if (!attribute.includes("product")) continue;
    const values = record.values;
    if (Array.isArray(values)) {
      for (const value of values) {
        if (typeof value === "string") ids.push(value);
        else if (value && typeof value === "object" && "value" in value) {
          const nested = (value as { value?: unknown }).value;
          if (typeof nested === "string") ids.push(nested);
        }
      }
    } else if (typeof values === "string") {
      ids.push(values);
    }
  }
  return ids;
}

function normalizePromotion(value: unknown): MerchantPromotion {
  const promotion = toRecord(value);
  const method = toRecord(promotion.application_method);
  const campaign = toRecord(promotion.campaign);
  const budget = toRecord(campaign.budget);
  const targetRules = method.target_rules ?? promotion.rules;
  const buyRules = method.buy_rules;

  return {
    applyToQuantity:
      method.apply_to_quantity == null ? null : Number(method.apply_to_quantity),
    buyMinQuantity:
      method.buy_rules_min_quantity == null ? null : Number(method.buy_rules_min_quantity),
    buyProductIds: ruleProductIds(buyRules),
    campaignBudgetLimit: budget.limit == null ? null : Number(budget.limit),
    campaignBudgetType:
      budget.type === "usage" || budget.type === "spend" ? budget.type : null,
    campaignName: stringOrNull(campaign.name),
    code: String(promotion.code ?? ""),
    createdAt: stringOr(promotion.created_at, new Date(0).toISOString()),
    currencyCode: stringOrNull(method.currency_code),
    endsAt: stringOrNull(campaign.ends_at) ?? stringOrNull(promotion.ends_at),
    id: String(promotion.id ?? ""),
    isAutomatic: Boolean(promotion.is_automatic),
    isTaxInclusive: Boolean(promotion.is_tax_inclusive),
    maxQuantity: method.max_quantity == null ? null : Number(method.max_quantity),
    method: method.type === "fixed" ? "fixed" : "percentage",
    productIds: ruleProductIds(targetRules),
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
