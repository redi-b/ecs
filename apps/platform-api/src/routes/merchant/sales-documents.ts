import {
  formatPublicOrderReference,
  type MerchantOperationsDocumentSummary,
  merchantOperationsDocumentKindSchema,
  merchantSalesDocumentKindSchema,
} from "@ecs/contracts";
import type { Hono } from "hono";
import { z } from "zod";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { snapshotMerchantDocumentBranding } from "../../modules/commerce/merchant-document-branding.js";
import { getPaginationValue } from "../shared.js";
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

  app.get("/platform/merchant/documents", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantSalesDocuments || !options.listMerchantQuotations) {
      return context.json({ error: "documents_unavailable" }, 503);
    }
    const q = context.req.query("q")?.trim();
    const kindValue = context.req.query("kind");
    const kind = kindValue ? merchantOperationsDocumentKindSchema.safeParse(kindValue) : null;
    const from = context.req.query("from");
    const to = context.req.query("to");
    if (
      (q && q.length > 120) ||
      (kind && !kind.success) ||
      (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
      (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) ||
      (from && to && from > to)
    ) {
      return context.json({ error: "invalid_document_filter" }, 400);
    }

    const tenantId = merchant.result.context.tenantId;
    const [salesDocuments, quotationResult] = await Promise.all([
      options.listMerchantSalesDocuments({ limit: 10_001, tenantId }),
      options.listMerchantQuotations({ limit: 10_001, offset: 0, tenantId }),
    ]);
    if (salesDocuments.length > 10_000 || quotationResult.count > 10_000) {
      return context.json({ error: "document_workspace_too_large" }, 413);
    }

    const documents: MerchantOperationsDocumentSummary[] = [
      ...salesDocuments.map((document) => ({
        createdAt: document.createdAt,
        customerLabel: salesDocumentCustomerLabel(document.snapshot.order),
        id: document.id,
        issuedAt: document.snapshot.issuedAt,
        kind: document.kind,
        language: document.language,
        number: document.number,
        orderId: document.orderId,
        orderReference: document.snapshot.orderReference,
        status: null,
        total: document.snapshot.order.total,
      })),
      ...quotationResult.quotations.map((quotation) => ({
        createdAt: quotation.createdAt,
        customerLabel: quotation.customerLabel,
        id: quotation.id,
        issuedAt: quotation.issuedAt,
        kind: "quotation" as const,
        language: quotation.language,
        number: quotation.number,
        orderId: quotation.convertedOrderId,
        orderReference: null,
        status: quotation.status,
        total: quotation.total,
      })),
    ];
    const normalizedQuery = q?.toLocaleLowerCase();
    const filtered = documents
      .filter((document) => !kind?.success || document.kind === kind.data)
      .filter((document) => !from || document.issuedAt.slice(0, 10) >= from)
      .filter((document) => !to || document.issuedAt.slice(0, 10) <= to)
      .filter(
        (document) =>
          !normalizedQuery ||
          [document.number, document.orderReference, document.customerLabel]
            .filter(Boolean)
            .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)),
      )
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
    const limit = getPaginationValue(context.req.query("limit"), 20, 100);
    const offset = getPaginationValue(context.req.query("offset"), 0, 10_000);
    return context.json({
      count: filtered.length,
      documents: filtered.slice(offset, offset + limit),
      limit,
      offset,
    });
  });

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
      branding: snapshotMerchantDocumentBranding(merchant.result.context.shopDetails),
      templateVersion: 2 as const,
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

function salesDocumentCustomerLabel(order: {
  delivery?: { customerName: string | null; customerPhone: string | null } | undefined;
  email: string | null;
  shippingAddress?:
    | {
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
      }
    | undefined;
}) {
  const shippingName = [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
    .filter(Boolean)
    .join(" ");
  return (
    order.delivery?.customerName ||
    shippingName ||
    order.email ||
    order.delivery?.customerPhone ||
    order.shippingAddress?.phone ||
    null
  );
}
