import { randomBytes } from "node:crypto";
import type {
  MerchantPromotion,
  MerchantPromotionCodeBatchInput,
  MerchantPromotionCodeBatchResult,
  MerchantPromotionDeleteResult,
  MerchantPromotionInput,
  MerchantPromotionResult,
  MerchantPromotionsResult,
} from "../../types/index.js";
import { mapMedusaFailure } from "./map-medusa-failure.js";
import { getAdminHeaders } from "./product/medusa-http.js";
import {
  categoryBelongsToTenantById,
  collectionBelongsToTenantById,
  filterProductIdsBySalesChannel,
} from "./product/ownership.js";
import type { PromotionSchedule } from "./promotion-schedule.js";

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
    schedule?: PromotionSchedule | undefined;
    apply?: "code" | "automatic" | undefined;
    limit: number;
    offer?: "order" | "products" | "free_shipping" | "buyget" | "percentage" | "fixed" | undefined;
    offset: number;
    query?: string | undefined;
    /** Stored status, independent of campaign schedule and eligibility. */
    status?: "active" | "inactive" | "draft" | undefined;
    tenantId: string;
  }): Promise<MerchantPromotionsResult> {
    const search = new URLSearchParams({
      tenant_id: input.tenantId,
      limit: String(input.limit),
      offset: String(input.offset),
    });
    if (input.query) search.set("q", input.query);
    for (const key of ["status", "apply", "offer", "schedule"] as const) {
      if (input[key]) search.set(key, input[key]);
    }
    const response = await fetcher(`${base}/admin/platform-promotions?${search}`, {
      headers: headers(),
    }).catch(() => null);
    if (!response?.ok) return promotionFailure(response);
    const data = toRecord(await response.json().catch(() => null));
    const count = numberOrNull(data.count);
    const ids = new Set<string>();
    if (
      !Array.isArray(data.promotions) ||
      count === null ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      data.promotions.length > input.limit
    ) {
      return { error: "commerce_backend_error", ok: false, status: 502 };
    }
    for (const item of data.promotions) {
      const id = stringOrNull(toRecord(item).id);
      if (!id || ids.has(id) || !isOwnedByTenant(item, input.tenantId)) {
        return { error: "commerce_backend_error", ok: false, status: 502 };
      }
      ids.add(id);
    }
    if (data.promotions.length > Math.max(0, count - input.offset)) {
      return { error: "commerce_backend_error", ok: false, status: 502 };
    }
    return {
      count,
      limit: input.limit,
      offset: input.offset,
      ok: true,
      promotions: data.promotions.map(normalizePromotion),
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
    const prepared = await prepareTargeting(input);
    if (!prepared.ok) return prepared;
    const response = await fetcher(`${base}/admin/promotions`, {
      body: JSON.stringify(toCreatePayload(prepared.input)),
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
    if (owned.promotion.hasUnsupportedRules) {
      return { ok: false, error: "promotion_rules_unsupported", status: 409 };
    }
    const prepared = await prepareTargeting(input);
    if (!prepared.ok) return prepared;

    const response = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(input.promotionId)}`,
      { body: JSON.stringify(toUpdatePayload(prepared.input)), headers: headers(), method: "POST" },
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

  async function createPromotionCodeBatch(
    input: MerchantPromotionCodeBatchInput,
  ): Promise<MerchantPromotionCodeBatchResult> {
    if (
      !Number.isInteger(input.count) ||
      input.count < 2 ||
      input.count > 50 ||
      !Number.isInteger(input.suffixLength) ||
      input.suffixLength < 6 ||
      input.suffixLength > 12
    ) {
      return { ok: false, error: "invalid_promotion_batch", status: 400 };
    }
    const response = await fetcher(
      `${base}/admin/promotions/${encodeURIComponent(input.promotionId)}?fields=+application_method,+application_method.target_rules,+application_method.buy_rules,+campaign,+rules`,
      { headers: headers() },
    ).catch(() => null);
    if (!response?.ok) return promotionFailure(response);
    const raw = toRecord((await response.json().catch(() => ({}))).promotion);
    if (!isOwnedByTenant(raw, input.tenantId)) {
      return { ok: false, error: "promotion_not_found", status: 404 };
    }
    const source = normalizePromotion(raw);
    const campaignId = stringOrNull(raw.campaign_id) ?? stringOrNull(toRecord(raw.campaign).id);
    if (source.isAutomatic || source.hasUnsupportedRules || !campaignId) {
      return { ok: false, error: "promotion_batch_unavailable", status: 409 };
    }
    const prefix = input.prefix
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 12);
    if (prefix.length < 2) return { ok: false, error: "invalid_promotion_batch", status: 400 };
    const template: PreparedPromotionInput = {
      allocation: source.allocation ?? undefined,
      applyToQuantity: source.applyToQuantity,
      buyMinQuantity: source.buyMinQuantity,
      buyProductIds: source.buyProductIds,
      campaignBudgetLimit: source.campaignBudgetLimit,
      campaignBudgetType: source.campaignBudgetType,
      campaignName: source.campaignName,
      categoryIds: source.categoryIds,
      code: source.code,
      collectionIds: source.collectionIds,
      currencyCode: source.currencyCode,
      endsAt: source.endsAt,
      isAutomatic: false,
      isTaxInclusive: source.isTaxInclusive,
      maxQuantity: source.maxQuantity,
      method: source.method,
      productIds: source.productIds,
      promotionType: source.promotionType,
      registeredCustomersOnly: source.registeredCustomersOnly,
      startsAt: source.startsAt,
      status: source.status,
      targetType: source.targetType,
      tenantId: input.tenantId,
      usageLimit: input.usageLimit ?? source.usageLimit,
      value: source.value,
      customerGroupId: ruleValues(raw.rules, "customer.groups.id")[0],
    };
    const codes: string[] = [];
    let failed = 0;
    for (let index = 0; index < input.count; index += 1) {
      const code = `${prefix}-${randomCode(input.suffixLength)}`;
      const payload = toUpdatePayload({ ...template, code });
      const created = await fetcher(`${base}/admin/promotions`, {
        body: JSON.stringify({ ...payload, campaign_id: campaignId }),
        headers: headers(),
        method: "POST",
      }).catch(() => null);
      if (created?.ok) codes.push(code);
      else failed += 1;
    }
    return { ok: true, promotionId: input.promotionId, requested: input.count, codes, failed };
  }

  return {
    createPromotion,
    createPromotionCodeBatch,
    deletePromotion,
    listPromotions,
    updatePromotion,
  };

  async function prepareTargeting(
    input: MerchantPromotionInput,
  ): Promise<
    | { ok: true; input: MerchantPromotionInput & { customerGroupId?: string | undefined } }
    | { ok: false; error: string; status: number }
  > {
    const targetSets = [input.productIds ?? [], input.categoryIds ?? [], input.collectionIds ?? []];
    if (targetSets.filter((ids) => ids.length > 0).length > 1) {
      return { ok: false, error: "invalid_promotion_target", status: 400 };
    }
    if (input.salesChannelId && input.productIds?.length) {
      const owned = await filterProductIdsBySalesChannel(
        fetcher,
        options,
        input.productIds,
        input.salesChannelId,
      );
      if (!Array.isArray(owned)) return owned;
      if (new Set(owned).size !== new Set(input.productIds).size) {
        return { ok: false, error: "promotion_target_not_found", status: 404 };
      }
    }
    for (const categoryId of input.categoryIds ?? []) {
      const owned = await categoryBelongsToTenantById(fetcher, options, categoryId, input.tenantId);
      if (typeof owned !== "boolean") return owned;
      if (!owned) return { ok: false, error: "promotion_target_not_found", status: 404 };
    }
    for (const collectionId of input.collectionIds ?? []) {
      const owned = await collectionBelongsToTenantById(
        fetcher,
        options,
        collectionId,
        input.tenantId,
      );
      if (typeof owned !== "boolean") return owned;
      if (!owned) return { ok: false, error: "promotion_target_not_found", status: 404 };
    }
    if (!input.registeredCustomersOnly) return { ok: true, input };
    const response = await fetcher(
      `${base}/admin/platform-customer-group?tenant_id=${encodeURIComponent(input.tenantId)}`,
      { headers: headers() },
    ).catch(() => null);
    if (!response?.ok) return promotionFailure(response);
    const data = toRecord(await response.json().catch(() => null));
    const groups = Array.isArray(data.customer_groups) ? data.customer_groups : [];
    const group = groups.length === 1 ? toRecord(groups[0]) : {};
    const metadata = toRecord(group.metadata);
    const customerGroupId = stringOrNull(group.id);
    if (
      numberOrNull(data.count) !== 1 ||
      metadata.tenant_id !== input.tenantId ||
      !customerGroupId
    ) {
      return { ok: false, error: "promotion_customer_group_unavailable", status: 503 };
    }
    return { ok: true, input: { ...input, customerGroupId } };
  }
}

const PROMOTION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number) {
  const bytes = randomBytes(length);
  return Array.from(
    bytes,
    (byte) => PROMOTION_CODE_ALPHABET[byte % PROMOTION_CODE_ALPHABET.length],
  ).join("");
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

function catalogRule(input: MerchantPromotionInput) {
  const candidates = [
    ["items.product.id", input.productIds],
    ["items.product.categories.id", input.categoryIds],
    ["items.product.collection_id", input.collectionIds],
  ] as const;
  for (const [attribute, rawIds] of candidates) {
    const values = (rawIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (values.length) return { attribute, operator: "in" as const, values };
  }
  return undefined;
}

type PreparedPromotionInput = MerchantPromotionInput & { customerGroupId?: string | undefined };

function toApplicationMethodPayload(input: PreparedPromotionInput) {
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

  const targetRule = catalogRule(input);
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

  return application_method;
}

function eligibilityRules(input: PreparedPromotionInput) {
  return input.customerGroupId
    ? [
        {
          attribute: "customer.groups.id",
          operator: "in" as const,
          values: [input.customerGroupId],
        },
      ]
    : undefined;
}

function toCreatePayload(input: PreparedPromotionInput) {
  const code = input.code.trim().toUpperCase();
  const promotionType = input.promotionType ?? "standard";
  const application_method = toApplicationMethodPayload(input);

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
    ...(eligibilityRules(input) ? { rules: eligibilityRules(input) } : {}),
    ...(input.usageLimit != null ? { limit: input.usageLimit } : {}),
    status: input.status,
    type: promotionType,
  };
}

function toUpdatePayload(input: PreparedPromotionInput) {
  const code = input.code.trim().toUpperCase();

  return {
    application_method: toApplicationMethodPayload(input),
    code,
    is_automatic: input.isAutomatic ?? false,
    is_tax_inclusive: input.isTaxInclusive ?? false,
    limit: input.usageLimit ?? null,
    rules: eligibilityRules(input) ?? [],
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

function ruleValues(rules: unknown, attribute: string): string[] {
  if (!Array.isArray(rules)) return [];
  return rules.flatMap((rule) => {
    const record = toRecord(rule);
    if (record.attribute !== attribute || record.operator !== "in") return [];
    return Array.isArray(record.values)
      ? record.values.flatMap((value) => {
          if (typeof value === "string") return [value];
          const nested = toRecord(value);
          return typeof nested.value === "string" ? [nested.value] : [];
        })
      : [];
  });
}

function hasUnsupportedRules(value: unknown, allowedAttributes: string[]) {
  if (!Array.isArray(value)) return false;
  return value.some((rule) => {
    const record = toRecord(rule);
    return record.operator !== "in" || !allowedAttributes.includes(String(record.attribute ?? ""));
  });
}

function normalizePromotion(value: unknown): MerchantPromotion {
  const promotion = toRecord(value);
  const method = toRecord(promotion.application_method);
  const campaign = toRecord(promotion.campaign);
  const budget = toRecord(campaign.budget);
  const targetRules = method.target_rules ?? [];
  const buyRules = method.buy_rules;
  const promotionRules = promotion.rules;
  const allowedTargetAttributes = [
    "items.product.id",
    "items.product.categories.id",
    "items.product.collection_id",
  ];

  return {
    allocation:
      method.allocation === "across" ? "across" : method.allocation === "each" ? "each" : null,
    applyToQuantity: method.apply_to_quantity == null ? null : Number(method.apply_to_quantity),
    buyMinQuantity:
      method.buy_rules_min_quantity == null ? null : Number(method.buy_rules_min_quantity),
    buyProductIds: ruleProductIds(buyRules),
    categoryIds: ruleValues(targetRules, "items.product.categories.id"),
    collectionIds: ruleValues(targetRules, "items.product.collection_id"),
    campaignBudgetLimit: budget.limit == null ? null : Number(budget.limit),
    campaignBudgetType: budget.type === "usage" || budget.type === "spend" ? budget.type : null,
    campaignName: stringOrNull(campaign.name),
    code: String(promotion.code ?? ""),
    createdAt: stringOr(promotion.created_at, new Date(0).toISOString()),
    currencyCode: stringOrNull(method.currency_code),
    endsAt: stringOrNull(campaign.ends_at) ?? stringOrNull(promotion.ends_at),
    id: String(promotion.id ?? ""),
    isAutomatic: Boolean(promotion.is_automatic),
    isTaxInclusive: Boolean(promotion.is_tax_inclusive),
    hasUnsupportedRules:
      hasUnsupportedRules(targetRules, allowedTargetAttributes) ||
      hasUnsupportedRules(buyRules, ["items.product.id"]) ||
      hasUnsupportedRules(promotionRules, ["customer.groups.id"]),
    maxQuantity: method.max_quantity == null ? null : Number(method.max_quantity),
    method: method.type === "fixed" ? "fixed" : "percentage",
    productIds: ruleProductIds(targetRules),
    registeredCustomersOnly: ruleValues(promotionRules, "customer.groups.id").length > 0,
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

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
