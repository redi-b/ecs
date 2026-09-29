import { formatPublicOrderReference, merchantSalesDocumentKindSchema } from "@ecs/contracts";
import type { Hono } from "hono";
import { z } from "zod";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import type { MerchantRouteHelpers } from "./context.js";

const issueSchema = z.object({
  kind: merchantSalesDocumentKindSchema,
  language: z.enum(["en", "am"]).default("en"),
});

function hasRecordedPayment(order: { paymentStatus: string | null; settlement?: unknown }) {
  return (
    Boolean(order.settlement) ||
    ["captured", "paid", "partially_refunded", "refunded"].includes(order.paymentStatus ?? "")
  );
}

export function registerMerchantSalesDocumentRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext, getResolvedCommerce } = helpers;

  app.get("/platform/merchant/orders/:orderId/documents", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantSalesDocuments)
      return context.json({ error: "sales_documents_unavailable" }, 503);
    return context.json({
      documents: await options.listMerchantSalesDocuments({
        orderId: context.req.param("orderId"),
        tenantId: merchant.result.context.tenantId,
      }),
    });
  });

  app.get("/platform/merchant/sales-documents/:documentId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.getMerchantSalesDocument)
      return context.json({ error: "sales_documents_unavailable" }, 503);
    const document = await options.getMerchantSalesDocument({
      documentId: context.req.param("documentId"),
      tenantId: merchant.result.context.tenantId,
    });
    return document
      ? context.json({ document })
      : context.json({ error: "sales_document_not_found" }, 404);
  });

  app.post("/platform/merchant/orders/:orderId/documents", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["create"] });
    if (!merchant.ok) return merchant.response;
    if (!options.getMerchantOrder || !options.issueMerchantSalesDocument)
      return context.json({ error: "sales_documents_unavailable" }, 503);
    const issueSalesDocument = options.issueMerchantSalesDocument;
    const parsed = issueSchema.safeParse(await context.req.json().catch(() => undefined));
    if (!parsed.success) return context.json({ error: "invalid_sales_document" }, 400);
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    const orderResult = await options.getMerchantOrder({
      orderId: context.req.param("orderId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!orderResult.ok) return context.json({ error: orderResult.error }, orderResult.status);
    if (orderResult.order.currencyCode?.toLowerCase() !== "etb")
      return context.json({ error: "sales_document_currency_unsupported" }, 409);
    if (parsed.data.kind === "payment_receipt" && !hasRecordedPayment(orderResult.order))
      return context.json({ error: "payment_receipt_requires_payment" }, 409);
    const snapshot = {
      complianceStatus: "operational_only" as const,
      currencyCode: "etb" as const,
      disclaimer: "Not a tax invoice / የታክስ ደረሰኝ አይደለም",
      issuedAt: new Date().toISOString(),
      kind: parsed.data.kind,
      language: parsed.data.language,
      order: orderResult.order,
      orderReference: formatPublicOrderReference(
        orderResult.order.id,
        orderResult.order.customDisplayId,
      ),
      sellerName: merchant.result.context.tenantName,
      templateVersion: 1 as const,
    };
    const issue = () =>
      issueSalesDocument({
        createdByUserId: merchant.session.user.id,
        snapshot,
        tenantId: merchant.result.context.tenantId,
      });
    const execution = options.executeMerchantMutation
      ? await options.executeMerchantMutation(
          {
            actorUserId: merchant.session.user.id,
            idempotencyKey,
            operation: "sales-document.issue",
            payload: parsed.data,
            requestId: context.get("requestId"),
            resourceKeys: [`order:${orderResult.order.id}`, `sales-document:${idempotencyKey}`],
            source: "assisted_sale",
            tenantId: merchant.result.context.tenantId,
          },
          issue,
        )
      : { ok: true as const, replayed: false, value: await issue() };
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    if (!execution.value) return context.json({ error: "sales_documents_unavailable" }, 503);
    context.header("x-idempotent-replay", String(execution.replayed));
    return context.json(execution.value, 201);
  });
}
