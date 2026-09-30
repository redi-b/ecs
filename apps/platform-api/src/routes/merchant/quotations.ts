import type { Hono } from "hono";
import { z } from "zod";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getOperationalCustomerEmail,
  normalizeOperationalPhone,
} from "../../modules/commerce/customer-identity.js";
import { snapshotMerchantDocumentBranding } from "../../modules/commerce/merchant-document-branding.js";
import { addQuoteValidityDays } from "../../modules/commerce/merchant-quotations.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

const issueSchema = z.object({
  draftId: z.string().trim().min(1),
  expiresAt: z.string().datetime().optional(),
  language: z.enum(["en", "am"]).default("en"),
});
const reviseSchema = issueSchema.extend({ expectedRevision: z.number().int().positive() });
const convertSchema = z.object({ confirmChanges: z.boolean().default(false) });

export function registerMerchantQuotationRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext, getResolvedCommerce } = helpers;

  app.get("/platform/merchant/quotations", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantQuotations)
      return context.json({ error: "quotations_unavailable" }, 503);
    const limit = getPaginationValue(context.req.query("limit"), 20, 100);
    const offset = getPaginationValue(context.req.query("offset"), 0, 10_000);
    return context.json(
      await options.listMerchantQuotations({
        limit,
        offset,
        tenantId: merchant.result.context.tenantId,
      }),
    );
  });

  app.get("/platform/merchant/quotations/:quotationId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.getMerchantQuotation)
      return context.json({ error: "quotations_unavailable" }, 503);
    const result = await options.getMerchantQuotation({
      quotationId: context.req.param("quotationId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/quotations", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["create"] });
    if (!merchant.ok) return merchant.response;
    if (
      !options.issueMerchantQuotation ||
      !options.getMerchantSaleDraft ||
      !options.validateMerchantSaleDraft
    ) {
      return context.json({ error: "quotations_unavailable" }, 503);
    }
    const issueQuotation = options.issueMerchantQuotation;
    const parsed = issueSchema.safeParse(await context.req.json().catch(() => undefined));
    if (!parsed.success) return context.json({ error: "invalid_quotation" }, 400);
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (options.executeMerchantMutation && !idempotencyKey) {
      return context.json({ error: "idempotency_key_required" }, 400);
    }
    const draftResult = await options.getMerchantSaleDraft({
      draftId: parsed.data.draftId,
      tenantId: merchant.result.context.tenantId,
    });
    if (!draftResult.ok) return context.json({ error: draftResult.error }, draftResult.status);
    if (draftResult.draft.conflicts.length > 0 || draftResult.draft.items.length === 0) {
      return context.json({ error: "quotation_draft_conflict" }, 409);
    }
    const {
      conflicts: _conflicts,
      createdAt: _createdAt,
      id: draftId,
      ownerUserId: _owner,
      revision: draftRevision,
      updatedAt: _updatedAt,
      ...content
    } = draftResult.draft;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    const validation = await options.validateMerchantSaleDraft({
      content,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId,
    });
    if (!validation.ok) return context.json({ error: validation.error }, validation.status);
    if (
      validation.conflicts.length > 0 ||
      validation.content.items.some((item) => item.unitPrice == null)
    ) {
      return context.json({ error: "quotation_draft_conflict" }, 409);
    }
    const now = new Date();
    const snapshot = {
      ...validation.content,
      draftId,
      draftRevision,
      expiresAt: parsed.data.expiresAt ?? addQuoteValidityDays(now),
      issuedAt: now.toISOString(),
      language: parsed.data.language,
      sellerName: merchant.result.context.tenantName,
      branding: snapshotMerchantDocumentBranding(merchant.result.context.shopDetails),
      templateVersion: 2 as const,
    };
    const issue = () =>
      issueQuotation({
        createdByUserId: merchant.session.user.id,
        snapshot,
        tenantId: merchant.result.context.tenantId,
      });
    let result: Awaited<ReturnType<typeof issue>>;
    let replayed = false;
    if (options.executeMerchantMutation && idempotencyKey) {
      const execution = await options.executeMerchantMutation(
        {
          actorUserId: merchant.session.user.id,
          idempotencyKey,
          operation: "quotation.issue",
          payload: parsed.data,
          requestId: context.get("requestId"),
          resourceKeys: [`sale-draft:${draftId}`, `quotation-issue:${idempotencyKey}`],
          source: "assisted_sale",
          tenantId: merchant.result.context.tenantId,
        },
        issue,
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      result = execution.value;
      replayed = execution.replayed;
    } else {
      result = await issue();
    }
    if (!result) return context.json({ error: "quotations_unavailable" }, 503);
    context.header("x-idempotent-replay", String(replayed));
    return context.json(result, 201);
  });

  app.post("/platform/merchant/quotations/:quotationId/revisions", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["create"] });
    if (!merchant.ok) return merchant.response;
    if (
      !options.reviseMerchantQuotation ||
      !options.getMerchantSaleDraft ||
      !options.validateMerchantSaleDraft
    ) {
      return context.json({ error: "quotations_unavailable" }, 503);
    }
    const reviseQuotation = options.reviseMerchantQuotation;
    const parsed = reviseSchema.safeParse(await context.req.json().catch(() => undefined));
    if (!parsed.success) return context.json({ error: "invalid_quotation" }, 400);
    const key = context.req.header("idempotency-key")?.trim();
    if (!key) return context.json({ error: "idempotency_key_required" }, 400);
    const draft = await options.getMerchantSaleDraft({
      draftId: parsed.data.draftId,
      tenantId: merchant.result.context.tenantId,
    });
    if (!draft.ok) return context.json({ error: draft.error }, draft.status);
    if (draft.draft.conflicts.length || !draft.draft.items.length) {
      return context.json({ error: "quotation_draft_conflict" }, 409);
    }
    const {
      conflicts: _conflicts,
      createdAt: _created,
      id: draftId,
      ownerUserId: _owner,
      revision: draftRevision,
      updatedAt: _updated,
      ...content
    } = draft.draft;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    const validation = await options.validateMerchantSaleDraft({
      content,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId,
    });
    if (!validation.ok) return context.json({ error: validation.error }, validation.status);
    if (
      validation.conflicts.length ||
      validation.content.items.some((item) => item.unitPrice == null)
    ) {
      return context.json({ error: "quotation_draft_conflict" }, 409);
    }
    const now = new Date();
    const snapshot = {
      ...validation.content,
      draftId,
      draftRevision,
      expiresAt: parsed.data.expiresAt ?? addQuoteValidityDays(now),
      issuedAt: now.toISOString(),
      language: parsed.data.language,
      sellerName: merchant.result.context.tenantName,
      branding: snapshotMerchantDocumentBranding(merchant.result.context.shopDetails),
      templateVersion: 2 as const,
    };
    const revise = () =>
      reviseQuotation({
        createdByUserId: merchant.session.user.id,
        expectedRevision: parsed.data.expectedRevision,
        quotationId: context.req.param("quotationId"),
        snapshot,
        tenantId: merchant.result.context.tenantId,
      });
    const execution = options.executeMerchantMutation
      ? await options.executeMerchantMutation(
          {
            actorUserId: merchant.session.user.id,
            idempotencyKey: key,
            operation: "quotation.revise",
            payload: parsed.data,
            requestId: context.get("requestId"),
            resourceKeys: [`quotation:${context.req.param("quotationId")}`],
            source: "assisted_sale",
            tenantId: merchant.result.context.tenantId,
          },
          revise,
        )
      : { ok: true as const, replayed: false, value: await revise() };
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    if (!execution.value) return context.json({ error: "quotations_unavailable" }, 503);
    if (!execution.value.ok) {
      return context.json({ error: execution.value.error }, execution.value.status);
    }
    context.header("x-idempotent-replay", String(execution.replayed));
    return context.json({ quotation: execution.value.quotation });
  });

  app.post("/platform/merchant/quotations/:quotationId/convert", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["create"] });
    if (!merchant.ok) return merchant.response;
    if (
      !options.getMerchantQuotation ||
      !options.createMerchantManualOrder ||
      !options.markMerchantQuotationConverted ||
      !options.validateMerchantSaleDraft
    ) {
      return context.json({ error: "quotation_conversion_unavailable" }, 503);
    }
    const parsed = convertSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) return context.json({ error: "invalid_quotation_conversion" }, 400);
    const key = context.req.header("idempotency-key")?.trim();
    if (!key) return context.json({ error: "idempotency_key_required" }, 400);
    const quotationId = context.req.param("quotationId");
    const loaded = await options.getMerchantQuotation({
      quotationId,
      tenantId: merchant.result.context.tenantId,
    });
    if (!loaded.ok) return context.json({ error: loaded.error }, loaded.status);
    if (loaded.quotation.convertedOrderId) {
      return context.json({
        orderId: loaded.quotation.convertedOrderId,
        quotation: loaded.quotation,
      });
    }
    if (Date.parse(loaded.quotation.snapshot.expiresAt) < Date.now()) {
      return context.json({ error: "quotation_expired" }, 409);
    }
    const commerce = getResolvedCommerce(merchant.result.context, { requireRegion: true });
    if (!commerce.ok || !commerce.context.medusaRegionId) {
      return context.json(
        { error: commerce.ok ? "commerce_region_unavailable" : commerce.error },
        503,
      );
    }
    const validation = await options.validateMerchantSaleDraft({
      content: loaded.quotation.snapshot,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId,
    });
    if (!validation.ok) return context.json({ error: validation.error }, validation.status);
    if (validation.conflicts.length && !parsed.data.confirmChanges) {
      return context.json(
        { conflicts: validation.conflicts, error: "quotation_conversion_changed" },
        409,
      );
    }
    const snapshot = loaded.quotation.snapshot;
    const phone = normalizeOperationalPhone(
      snapshot.customer.phone ?? snapshot.shippingAddress?.phone,
    );
    const email = getOperationalCustomerEmail({
      email: snapshot.customer.email,
      phone,
      tenantId: merchant.result.context.tenantId,
    });
    if (!email) return context.json({ error: "invalid_quotation_customer" }, 409);
    const convert = async () => {
      const order = await options.createMerchantManualOrder?.({
        adjustmentReason: snapshot.adjustmentReason,
        customerEmail: email,
        customerId: snapshot.customer.id,
        discount: snapshot.discount,
        idempotencyKey: key,
        items: snapshot.items.map(({ quantity, unitPrice, variantId }) => ({
          quantity,
          unitPrice,
          variantId,
        })),
        note: snapshot.note,
        quotationId,
        quotationRevision: loaded.quotation.currentRevision,
        regionId: commerce.context.medusaRegionId as string,
        salesChannelId: commerce.context.medusaSalesChannelId,
        shippingAddress: snapshot.shippingAddress,
        shippingOptionId: snapshot.shippingOptionId,
        source: "quote_conversion",
        tenantId: merchant.result.context.tenantId,
        userId: merchant.session.user.id,
      });
      if (!order?.ok) return order;
      const marked = await options.markMerchantQuotationConverted?.({
        orderId: order.order.id,
        quotationId,
        tenantId: merchant.result.context.tenantId,
      });
      return marked
        ? order
        : {
            ok: false as const,
            error: "quotation_conversion_repair_required",
            status: 503 as const,
          };
    };
    const execution = options.executeMerchantMutation
      ? await options.executeMerchantMutation(
          {
            actorUserId: merchant.session.user.id,
            idempotencyKey: key,
            operation: "quotation.convert",
            payload: {
              confirmChanges: parsed.data.confirmChanges,
              quotationId,
              revision: loaded.quotation.currentRevision,
            },
            requestId: context.get("requestId"),
            resourceKeys: [`quotation:${quotationId}`],
            source: "quote_conversion",
            tenantId: merchant.result.context.tenantId,
          },
          convert,
        )
      : { ok: true as const, replayed: false, value: await convert() };
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    if (!execution.value?.ok) {
      return context.json(
        { error: execution.value?.error ?? "quotation_conversion_unavailable" },
        execution.value?.status ?? 503,
      );
    }
    context.header("x-idempotent-replay", String(execution.replayed));
    return context.json({ order: execution.value.order });
  });
}
