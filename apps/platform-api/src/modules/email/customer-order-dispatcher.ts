import { formatPublicOrderReference } from "@ecs/contracts";
import type { createPlatformDb } from "@ecs/db";
import { inAppNotificationEvents, tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import { getNotificationEventDefinition } from "../notifications/event-registry.js";
import type { EmailTemplateLocale } from "./template-catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type EnqueueEmail = (input: {
  idempotencySource: string;
  locale?: EmailTemplateLocale | undefined;
  recipient: string;
  templateKey: string;
  tenantId?: string | null | undefined;
  variables: Record<string, string>;
}) => Promise<unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function isDeliverableCustomerEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return domain !== "orders.local" && !domain.endsWith(".invalid") && domain !== "example.invalid";
}

export function formatOrderTotal(payload: Record<string, unknown>) {
  const amount = pickString(payload, "amount", "total");
  const currency = pickString(payload, "currencyCode", "currency_code")?.toUpperCase() ?? "ETB";
  if (!amount) return currency;
  const numeric = Number(amount);
  const display = Number.isFinite(numeric)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric)
    : amount;
  return `${currency} ${display}`;
}

export function buildCustomerOrderEmail(input: {
  eventId: string;
  eventType: string;
  payload: unknown;
  tenantId: string;
  tenantName: string;
}) {
  const templateKey = getNotificationEventDefinition(input.eventType)?.customerDelivery?.templateId;
  if (!templateKey) return { skipped: "event_not_customer_email" as const };

  const payload = asRecord(input.payload);
  const recipient = pickString(payload, "customerEmail", "customer_email");
  if (!isDeliverableCustomerEmail(recipient)) {
    return { skipped: "customer_email_unavailable" as const };
  }
  const orderId = pickString(payload, "orderId", "order_id");
  if (!orderId) throw new Error("customer_order_email_order_id_missing");
  const sourceEventId = pickString(payload, "sourceEventId", "source_event_id") ?? input.eventId;
  const locale = pickString(payload, "customerLocale", "customer_locale") === "am" ? "am" : "en";
  return {
    email: {
      idempotencySource: `${input.eventType}:v1:${sourceEventId}`,
      locale,
      recipient,
      templateKey,
      tenantId: input.tenantId,
      variables: {
        order_reference:
          pickString(payload, "publicOrderReference", "orderDisplayId", "displayId") ??
          formatPublicOrderReference(orderId),
        order_total: formatOrderTotal(payload),
        recipient_name: pickString(payload, "customerName", "customer_name") ?? "Customer",
        shop_name: input.tenantName.trim() || "Your shop",
      },
    },
  } as const;
}

export function createCustomerOrderEmailDispatcher(input: {
  db: PlatformDb;
  enqueueEmail: EnqueueEmail;
}) {
  return async (eventId: string) => {
    const [event] = await input.db
      .select({
        eventType: inAppNotificationEvents.eventType,
        payload: inAppNotificationEvents.payload,
        tenantId: inAppNotificationEvents.tenantId,
      })
      .from(inAppNotificationEvents)
      .where(eq(inAppNotificationEvents.id, eventId))
      .limit(1);
    if (!event) throw new Error("in_app_event_not_found");

    if (!getNotificationEventDefinition(event.eventType)?.customerDelivery) {
      return { skipped: "event_not_customer_email" as const };
    }
    const recipient = pickString(asRecord(event.payload), "customerEmail", "customer_email");
    if (!isDeliverableCustomerEmail(recipient)) {
      return { skipped: "customer_email_unavailable" as const };
    }

    const [tenant] = await input.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, event.tenantId))
      .limit(1);
    if (!tenant) throw new Error("tenant_not_found");
    const delivery = buildCustomerOrderEmail({
      eventId,
      eventType: event.eventType,
      payload: event.payload,
      tenantId: event.tenantId,
      tenantName: tenant.name,
    });
    if (!("email" in delivery)) return delivery;
    await input.enqueueEmail(delivery.email);
    return { queued: true as const, templateKey: delivery.email.templateKey };
  };
}
