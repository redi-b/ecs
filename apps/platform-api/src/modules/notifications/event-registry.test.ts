import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NotificationEventType } from "../../types/index.js";
import { getEmailTemplateDefinition } from "../email/template-catalog.js";
import {
  canonicalizeRegisteredNotificationEvent,
  getNotificationEventDefinition,
  NOTIFICATION_EVENT_REGISTRY,
  validateNotificationEventPayload,
} from "./event-registry.js";
import { CODE_NOTIFICATION_TEMPLATE_EVENTS, createCodeNotificationRenderer } from "./renderer.js";

describe("notification event registry", () => {
  it("contains every declared event exactly once", () => {
    const declared: NotificationEventType[] = [
      "cod_order.created",
      "billing.invoice_ready",
      "billing.past_due",
      "chapa.onboarding_needs_review",
      "domain.misconfigured",
      "inventory.low",
      "notification.test",
      "order.created",
      "order.cancelled",
      "order.confirmed",
      "order.delivered",
      "order.out_for_delivery",
      "order.ready",
      "payment.paid",
      "payment.failed",
      "payment.webhook_failed",
      "shop.provisioning_failed",
      "shop.published",
      "shop.suspended",
      "storefront.inquiry_created",
    ];
    assert.deepEqual([...NOTIFICATION_EVENT_REGISTRY.keys()].sort(), declared.sort());
  });

  it("records an emitter and template for every production channel", () => {
    for (const definition of NOTIFICATION_EVENT_REGISTRY.values()) {
      if (definition.status !== "production") continue;
      assert.ok(definition.emitter, `${definition.eventType} must name its authoritative emitter`);
      for (const channel of definition.channels) {
        assert.ok(
          definition.templateIds[channel],
          `${definition.eventType} must define its ${channel} template`,
        );
      }
      assert.ok(
        CODE_NOTIFICATION_TEMPLATE_EVENTS.has(definition.eventType),
        `${definition.eventType} must have a code renderer template`,
      );
      if (definition.customerDelivery) {
        assert.ok(
          definition.channels.includes("in_app"),
          `${definition.eventType} customer delivery requires durable event storage`,
        );
        assert.equal(definition.customerDelivery.configurable, false);
        assert.equal(definition.customerDelivery.consent, "transactional_service");
        assert.ok(
          getEmailTemplateDefinition(definition.customerDelivery.templateId),
          `${definition.eventType} must reference a customer email template in the catalog`,
        );
      }
    }
  });

  it("validates and renders every production fixture on each configured channel", async () => {
    const renderer = createCodeNotificationRenderer();
    for (const definition of NOTIFICATION_EVENT_REGISTRY.values()) {
      if (definition.status !== "production") continue;
      assert.equal(
        validateNotificationEventPayload(definition.eventType, definition.fixture).ok,
        true,
        `${definition.eventType} fixture must satisfy its payload contract`,
      );
      for (const channel of definition.channels) {
        const rendered = await renderer.render({
          channel,
          eventType: definition.eventType,
          payload: definition.fixture,
          recipient: "fixture@example.com",
          tenantId: "tenant_fixture",
        });
        assert.ok(rendered.body.trim(), `${definition.eventType}:${channel} must render a body`);
      }
    }
  });

  it("canonicalizes the legacy COD alias", () => {
    assert.equal(canonicalizeRegisteredNotificationEvent("cod_order.created"), "order.created");
    assert.equal(getNotificationEventDefinition("cod_order.created")?.eventType, "order.created");
  });

  it("rejects unknown, non-object, and sensitive payloads", () => {
    assert.deepEqual(validateNotificationEventPayload("unknown.event", {}), {
      ok: false,
      error: "notification_event_unknown",
    });
    assert.equal(validateNotificationEventPayload("order.created", "not-an-object").ok, false);
    assert.deepEqual(
      validateNotificationEventPayload("order.created", {
        orderId: "order_1",
        checkout: { payment_secret: "secret" },
      }),
      {
        ok: false,
        error: "notification_event_payload_sensitive",
        field: "checkout.payment_secret",
      },
    );
  });
});
