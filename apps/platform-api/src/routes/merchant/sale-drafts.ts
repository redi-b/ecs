import { merchantSaleDraftContentSchema } from "@ecs/contracts";
import type { Context, Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

export function registerMerchantSaleDraftRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext, getResolvedCommerce } = helpers;

  app.get("/platform/merchant/sale-drafts", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantSaleDrafts) {
      return context.json({ error: "sale_drafts_unavailable" }, 503);
    }
    const limit = getPaginationValue(context.req.query("limit"), 20, 100);
    const offset = getPaginationValue(context.req.query("offset"), 0, 10_000);
    const channelValue = context.req.query("channel");
    if (channelValue && channelValue !== "assisted_sale" && channelValue !== "pos") {
      return context.json({ error: "invalid_sale_draft_channel" }, 400);
    }
    const result = await options.listMerchantSaleDrafts({
      ...(channelValue ? { channel: channelValue } : {}),
      limit,
      offset,
      tenantId: merchant.result.context.tenantId,
    });
    return context.json(result);
  });

  app.get("/platform/merchant/sale-drafts/:draftId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.getMerchantSaleDraft) {
      return context.json({ error: "sale_drafts_unavailable" }, 503);
    }
    const result = await options.getMerchantSaleDraft({
      draftId: context.req.param("draftId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json({ draft: result.draft })
      : context.json({ error: result.error }, result.status);
  });

  const save = async (context: Context<{ Variables: PlatformAppVariables }>) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["create"] });
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.saveMerchantSaleDraft) {
      return context.json({ error: "sale_drafts_unavailable" }, 503);
    }
    const saveDraft = options.saveMerchantSaleDraft;
    const body = await context.req.json().catch(() => undefined);
    const parsed = merchantSaleDraftContentSchema.safeParse(body);
    if (!parsed.success) return context.json({ error: "invalid_sale_draft" }, 400);
    const expectedRevision =
      body && typeof body === "object" && "expectedRevision" in body
        ? Number((body as { expectedRevision?: unknown }).expectedRevision)
        : undefined;
    const draftId = context.req.param("draftId") || undefined;
    if (draftId && (!Number.isInteger(expectedRevision) || Number(expectedRevision) < 1)) {
      return context.json({ error: "sale_draft_revision_required" }, 400);
    }
    const execute = () =>
      saveDraft({
        content: parsed.data,
        draftId,
        expectedRevision,
        ownerUserId: merchant.session.user.id,
        salesChannelId: commerce.context.medusaSalesChannelId,
        stockLocationId: commerce.context.medusaStockLocationId,
        tenantId: merchant.result.context.tenantId,
      });
    let result: Awaited<ReturnType<typeof execute>>;
    if (options.executeMerchantMutation) {
      const idempotencyKey = context.req.header("idempotency-key")?.trim();
      if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
      const execution = await options.executeMerchantMutation(
        {
          actorUserId: merchant.session.user.id,
          idempotencyKey,
          operation: "sale_draft.save",
          payload: { content: parsed.data, draftId, expectedRevision },
          requestId: context.get("requestId"),
          resourceKeys: [draftId ? `sale-draft:${draftId}` : `sale-draft-create:${idempotencyKey}`],
          source: parsed.data.channel === "pos" ? "pos" : "assisted_sale",
          tenantId: merchant.result.context.tenantId,
        },
        execute,
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      context.header("x-idempotent-replay", String(execution.replayed));
      result = execution.value;
    } else {
      result = await execute();
    }
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ draft: result.draft }, draftId ? 200 : 201);
  };

  app.post("/platform/merchant/sale-drafts", save);
  app.post("/platform/merchant/sale-drafts/:draftId", save);

  app.delete("/platform/merchant/sale-drafts/:draftId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["create"] });
    if (!merchant.ok) return merchant.response;
    if (!options.archiveMerchantSaleDraft) {
      return context.json({ error: "sale_drafts_unavailable" }, 503);
    }
    const archiveDraft = options.archiveMerchantSaleDraft;
    const body = (await context.req.json().catch(() => ({}))) as { revision?: unknown };
    const expectedRevision = Number(body.revision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      return context.json({ error: "sale_draft_revision_required" }, 400);
    }
    const draftId = context.req.param("draftId");
    const archive = () =>
      archiveDraft({
        draftId,
        expectedRevision,
        tenantId: merchant.result.context.tenantId,
      });
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (options.executeMerchantMutation && !idempotencyKey) {
      return context.json({ error: "idempotency_key_required" }, 400);
    }
    let archived: Awaited<ReturnType<typeof archive>>;
    let replayed = false;
    if (options.executeMerchantMutation && idempotencyKey) {
      const execution = await options.executeMerchantMutation(
        {
          actorUserId: merchant.session.user.id,
          idempotencyKey,
          operation: "sale_draft.delete",
          payload: { draftId, expectedRevision },
          requestId: context.get("requestId"),
          resourceKeys: [`sale-draft:${draftId}`],
          source: "assisted_sale",
          tenantId: merchant.result.context.tenantId,
        },
        archive,
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      archived = execution.value;
      replayed = execution.replayed;
    } else {
      archived = await archive();
    }
    if (!archived.ok) {
      return context.json({ error: archived.error }, archived.status);
    }
    context.header("x-idempotent-replay", String(replayed));
    return context.body(null, 204);
  });
}
