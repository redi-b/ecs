import { z } from "zod";

import type { MerchantPermissionRequest } from "../../context/merchant-permissions.js";
import type { NotificationEventType } from "../../types/index.js";
import type { EmailTemplateKey } from "../email/template-catalog.js";

export type NotificationEventCategory = "billing" | "inquiries" | "inventory" | "orders" | "system";
export type NotificationEventPriority = "high" | "normal";
export type NotificationEventAudience =
  | { type: "all_members" }
  | { type: "permission"; permission: MerchantPermissionRequest };
export type NotificationEventChannel = "email" | "in_app" | "telegram";
export type NotificationCustomerDelivery = {
  channel: "email";
  configurable: false;
  consent: "transactional_service";
  templateId: EmailTemplateKey;
};

export type NotificationEventDefinition = {
  aliases?: readonly string[];
  audience: NotificationEventAudience;
  category: NotificationEventCategory;
  channels: readonly NotificationEventChannel[];
  configurable: boolean;
  context: "account" | "billing" | "catalog" | "commerce" | "storefront" | "tenant";
  dedupe: "entity" | "entity_daily" | "source_event";
  deepLink: "billing" | "inquiries" | "none" | "order" | "product";
  customerDelivery?: NotificationCustomerDelivery;
  emitter: string | null;
  eventType: NotificationEventType;
  fixture: Record<string, unknown>;
  payloadSchema: z.ZodType<Record<string, unknown>>;
  priority: NotificationEventPriority;
  prohibitedPayloadFields: readonly string[];
  retentionDays: number;
  status: "legacy" | "planned" | "production";
  templateIds: Partial<Record<NotificationEventChannel, string>>;
  version: 1;
};

const payload = z
  .object({
    medusaSalesChannelId: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    sourceEventId: z.string().min(1).optional(),
  })
  .passthrough();
const orderPayload = payload.extend({
  orderId: z.string().min(1),
});
const inventoryPayload = payload.extend({ variantId: z.string().min(1) });
const inquiryPayload = payload.extend({ inquiryId: z.string().min(1) });
const invoicePayload = payload.extend({ invoiceId: z.string().min(1) });
const subscriptionPayload = payload.extend({ subscriptionId: z.string().min(1) });
const paymentPayload = payload.superRefine((value, context) => {
  if (
    (typeof value.orderId !== "string" || !value.orderId.trim()) &&
    (typeof value.txRef !== "string" || !value.txRef.trim())
  ) {
    context.addIssue({
      code: "custom",
      message: "Payment events require orderId or txRef",
      path: ["orderId"],
    });
  }
});
const orderAudience = {
  type: "permission",
  permission: { orders: ["read"] },
} as const satisfies NotificationEventAudience;
const billingAudience = {
  type: "permission",
  permission: { billing: ["read"] },
} as const satisfies NotificationEventAudience;
const systemAudience = { type: "all_members" } as const satisfies NotificationEventAudience;
const prohibited = [
  "password",
  "passwordHash",
  "paymentSecret",
  "providerSecret",
  "token",
] as const;
const customerOrderTemplates: Partial<Record<NotificationEventType, EmailTemplateKey>> = {
  "order.cancelled": "customer.order_cancelled",
  "order.created": "customer.order_confirmation",
  "order.delivered": "customer.order_delivered",
  "order.out_for_delivery": "customer.order_out_for_delivery",
  "order.ready": "customer.order_ready",
};
const orderFixture = {
  amount: "1850",
  currencyCode: "ETB",
  customerEmail: "liya@example.com",
  customerName: "Liya",
  orderId: "order_01EVENTFIXTURE",
  publicOrderReference: "ECS-1042",
  sourceEventId: "order.fixture:order_01EVENTFIXTURE",
};

function defineEvent(definition: NotificationEventDefinition): NotificationEventDefinition {
  return definition;
}

const definitions = [
  defineEvent({
    eventType: "cod_order.created",
    aliases: [],
    version: 1,
    context: "commerce",
    status: "legacy",
    emitter: null,
    fixture: { orderId: "order_legacy" },
    audience: orderAudience,
    channels: [],
    configurable: false,
    payloadSchema: payload,
    prohibitedPayloadFields: prohibited,
    dedupe: "entity",
    templateIds: {},
    deepLink: "order",
    priority: "normal",
    category: "orders",
    retentionDays: 90,
  }),
  ...(
    [
      ["order.created", "Medusa order.placed subscriber", "production", "normal"],
      ["order.cancelled", "Medusa order.canceled subscriber", "production", "normal"],
      ["order.confirmed", null, "planned", "normal"],
      ["order.ready", "Medusa order.fulfillment_created subscriber", "production", "normal"],
      ["order.out_for_delivery", "Medusa shipment.created subscriber", "production", "normal"],
      ["order.delivered", "Medusa delivery.created subscriber", "production", "normal"],
      [
        "payment.paid",
        "Medusa payment.captured subscriber and payment reconciliation",
        "production",
        "normal",
      ],
      ["payment.failed", "Chapa payment reconciliation", "production", "high"],
      ["payment.webhook_failed", "Chapa webhook inbox", "production", "high"],
    ] as const
  ).map(([eventType, emitter, status, priority]) =>
    defineEvent({
      eventType,
      version: 1,
      context: "commerce",
      status,
      emitter,
      fixture: eventType.startsWith("order.")
        ? orderFixture
        : { orderId: "order_01EVENTFIXTURE", txRef: "ecs_tx_fixture" },
      audience: orderAudience,
      channels:
        status === "production"
          ? eventType === "payment.webhook_failed"
            ? ["email", "telegram"]
            : ["email", "in_app", "telegram"]
          : [],
      configurable: status === "production",
      payloadSchema: eventType.startsWith("order.") ? orderPayload : paymentPayload,
      prohibitedPayloadFields: prohibited,
      dedupe: eventType === "payment.failed" ? "entity_daily" : "entity",
      templateIds:
        status === "production"
          ? {
              email: `merchant.${eventType}.v1`,
              ...(eventType !== "payment.webhook_failed"
                ? { in_app: `merchant.${eventType}.v1` }
                : {}),
              telegram: `merchant.${eventType}.v1`,
            }
          : {},
      ...(customerOrderTemplates[eventType]
        ? {
            customerDelivery: {
              channel: "email",
              configurable: false,
              consent: "transactional_service",
              templateId: customerOrderTemplates[eventType],
            },
          }
        : {}),
      deepLink: "order",
      priority,
      category: "orders",
      retentionDays: priority === "high" ? 180 : 90,
    }),
  ),
  defineEvent({
    eventType: "inventory.low",
    version: 1,
    context: "catalog",
    status: "production",
    emitter: "Medusa order.placed inventory threshold evaluator",
    fixture: {
      availableQuantity: 2,
      productId: "prod_fixture",
      productTitle: "Cotton Wrap Blouse",
      variantId: "variant_fixture",
    },
    audience: { type: "permission", permission: { products: ["read"] } },
    channels: ["email", "in_app", "telegram"],
    configurable: true,
    payloadSchema: inventoryPayload,
    prohibitedPayloadFields: prohibited,
    dedupe: "entity_daily",
    templateIds: {
      email: "merchant.inventory.low.v1",
      in_app: "merchant.inventory.low.v1",
      telegram: "merchant.inventory.low.v1",
    },
    deepLink: "product",
    priority: "normal",
    category: "inventory",
    retentionDays: 30,
  }),
  ...(["billing.invoice_ready", "billing.past_due", "billing.payment_rejected"] as const).map(
    (eventType) =>
      defineEvent({
        eventType,
        version: 1,
        context: "billing",
        status: "production",
        emitter: "Billing lifecycle outbox",
        fixture:
          eventType === "billing.invoice_ready" || eventType === "billing.payment_rejected"
            ? { amount: "1000", currencyCode: "ETB", invoiceId: "invoice_fixture" }
            : { amount: "1000", currencyCode: "ETB", subscriptionId: "subscription_fixture" },
        audience: billingAudience,
        channels: ["email", "in_app", "telegram"],
        configurable: true,
        payloadSchema:
          eventType === "billing.invoice_ready" || eventType === "billing.payment_rejected"
            ? invoicePayload
            : subscriptionPayload,
        prohibitedPayloadFields: prohibited,
        dedupe: eventType === "billing.past_due" ? "entity_daily" : "entity",
        templateIds: {
          email: `merchant.${eventType}.v1`,
          in_app: `merchant.${eventType}.v1`,
          telegram: `merchant.${eventType}.v1`,
        },
        deepLink: "billing",
        priority:
          eventType === "billing.past_due" || eventType === "billing.payment_rejected"
            ? "high"
            : "normal",
        category: "billing",
        retentionDays:
          eventType === "billing.past_due" || eventType === "billing.payment_rejected" ? 180 : 90,
      }),
  ),
  ...(["billing.trial_started", "billing.trial_ending", "billing.trial_expired"] as const).map(
    (eventType) =>
      defineEvent({
        eventType,
        version: 1,
        context: "billing",
        status: "production",
        emitter: "Billing trial lifecycle",
        fixture: {
          endsAt: "2026-09-27T00:00:00.000Z",
          planName: "Business",
          subscriptionId: "subscription_fixture",
        },
        audience: billingAudience,
        channels: ["email", "in_app", "telegram"],
        configurable: true,
        payloadSchema: subscriptionPayload,
        prohibitedPayloadFields: prohibited,
        dedupe: "entity",
        templateIds: {
          email: `merchant.${eventType}.v1`,
          in_app: `merchant.${eventType}.v1`,
          telegram: `merchant.${eventType}.v1`,
        },
        deepLink: "billing",
        priority: eventType === "billing.trial_ending" ? "high" : "normal",
        category: "billing",
        retentionDays: 90,
      }),
  ),
  defineEvent({
    eventType: "storefront.inquiry_created",
    version: 1,
    context: "storefront",
    status: "production",
    emitter: "Storefront inquiry creation transaction",
    fixture: {
      customerName: "Liya",
      inquiryId: "inquiry_fixture",
      subject: "Question about a product",
      type: "general",
    },
    audience: { type: "permission", permission: { inquiries: ["read"] } },
    channels: ["email", "in_app", "telegram"],
    configurable: true,
    payloadSchema: inquiryPayload,
    prohibitedPayloadFields: prohibited,
    dedupe: "entity",
    templateIds: {
      email: "merchant.storefront.inquiry_created.v1",
      in_app: "merchant.storefront.inquiry_created.v1",
      telegram: "merchant.storefront.inquiry_created.v1",
    },
    deepLink: "inquiries",
    priority: "normal",
    category: "inquiries",
    retentionDays: 90,
  }),
  ...(
    [
      ["shop.published", "tenant", "planned"],
      ["shop.provisioning_failed", "tenant", "planned"],
      ["shop.suspended", "tenant", "planned"],
      ["domain.misconfigured", "tenant", "planned"],
      ["chapa.onboarding_needs_review", "commerce", "planned"],
    ] as const
  ).map(([eventType, context, status]) =>
    defineEvent({
      eventType,
      version: 1,
      context,
      status,
      emitter: null,
      fixture: { reason: "fixture" },
      audience: systemAudience,
      channels: [],
      configurable: false,
      payloadSchema: payload,
      prohibitedPayloadFields: prohibited,
      dedupe: "entity",
      templateIds: {},
      deepLink: "none",
      priority:
        eventType.includes("failed") || eventType.includes("misconfigured") ? "high" : "normal",
      category: "system",
      retentionDays: 90,
    }),
  ),
  defineEvent({
    eventType: "notification.test",
    version: 1,
    context: "tenant",
    status: "production",
    emitter: "Merchant notification settings test action",
    fixture: { shopName: "Bole Style", testId: "test_fixture" },
    audience: systemAudience,
    channels: ["email", "telegram"],
    configurable: false,
    payloadSchema: payload,
    prohibitedPayloadFields: prohibited,
    dedupe: "source_event",
    templateIds: {
      email: "merchant.notification.test.v1",
      telegram: "merchant.notification.test.v1",
    },
    deepLink: "none",
    priority: "normal",
    category: "system",
    retentionDays: 7,
  }),
] satisfies NotificationEventDefinition[];

export const NOTIFICATION_EVENT_REGISTRY = new Map(
  definitions.map((definition) => [definition.eventType, definition] as const),
);

export function getNotificationEventDefinition(eventType: string) {
  const canonical = eventType === "cod_order.created" ? "order.created" : eventType;
  return NOTIFICATION_EVENT_REGISTRY.get(canonical as NotificationEventType) ?? null;
}

export function canonicalizeRegisteredNotificationEvent(eventType: string): string {
  return eventType === "cod_order.created" ? "order.created" : eventType;
}

export function validateNotificationEventPayload(eventType: string, value: unknown) {
  const definition = getNotificationEventDefinition(eventType);
  if (!definition) return { ok: false as const, error: "notification_event_unknown" as const };
  const result = definition.payloadSchema.safeParse(value);
  if (!result.success) {
    return { ok: false as const, error: "notification_event_payload_invalid" as const };
  }
  const prohibitedField = findProhibitedPayloadField(
    result.data,
    new Set(definition.prohibitedPayloadFields.map(normalizePayloadField)),
  );
  if (prohibitedField) {
    return {
      ok: false as const,
      error: "notification_event_payload_sensitive" as const,
      field: prohibitedField,
    };
  }
  return { ok: true as const, payload: result.data };
}

function findProhibitedPayloadField(
  value: unknown,
  prohibitedFields: ReadonlySet<string>,
  path = "",
  depth = 0,
): string | null {
  if (depth > 8 || value === null || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (prohibitedFields.has(normalizePayloadField(key))) return childPath;
    const nested = findProhibitedPayloadField(child, prohibitedFields, childPath, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function normalizePayloadField(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
