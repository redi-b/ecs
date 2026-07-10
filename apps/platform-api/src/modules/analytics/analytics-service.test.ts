import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type AnalyticsEventStore,
  type AnalyticsInsightsStore,
  createAnalyticsInsightsService,
  createAnalyticsService,
} from "./analytics-service.js";

describe("createAnalyticsService", () => {
  it("records tenant-scoped storefront events with normalized metadata", async () => {
    const inserted: Parameters<AnalyticsEventStore["insertEvent"]>[0][] = [];
    const store: AnalyticsEventStore = {
      findEventByIdempotencyKey: async () => null,
      insertEvent: async (event) => {
        inserted.push(event);

        return {
          ...event,
          id: "event_1",
          receivedAt: new Date("2026-01-01T12:00:01.000Z"),
        };
      },
    };

    const service = createAnalyticsService(store);

    const result = await service.recordAnalyticsEvent({
      eventType: " storefront.page_viewed ",
      idempotencyKey: " view-1 ",
      occurredAt: "2026-01-01T12:00:00.000Z",
      properties: {
        path: "/products/coffee",
      },
      sessionId: "anonymous-session-1",
      source: "storefront",
      tenantId: "tenant_1",
    });

    assert.equal(result.ok, true);
    assert.equal(result.duplicate, false);
    assert.deepEqual(inserted, [
      {
        customerId: null,
        eventType: "storefront.page_viewed",
        idempotencyKey: "view-1",
        occurredAt: new Date("2026-01-01T12:00:00.000Z"),
        properties: {
          path: "/products/coffee",
        },
        sessionIdHash: "a0cd3041809c9a675a00f1376d1132c68f0e07f5cee6747abd8d37c3e36eccaa",
        source: "storefront",
        subjectId: null,
        subjectType: null,
        tenantId: "tenant_1",
      },
    ]);
  });

  it("deduplicates tenant events by source and idempotency key", async () => {
    let insertCalls = 0;
    const store: AnalyticsEventStore = {
      findEventByIdempotencyKey: async (input) => {
        assert.deepEqual(input, {
          idempotencyKey: "checkout-started-1",
          source: "storefront",
          tenantId: "tenant_1",
        });

        return {
          customerId: null,
          eventType: "storefront.checkout_started",
          id: "event_existing",
          idempotencyKey: "checkout-started-1",
          occurredAt: new Date("2026-01-01T12:00:00.000Z"),
          properties: {},
          receivedAt: new Date("2026-01-01T12:00:01.000Z"),
          sessionIdHash: null,
          source: "storefront",
          subjectId: null,
          subjectType: null,
          tenantId: "tenant_1",
        };
      },
      insertEvent: async () => {
        insertCalls += 1;
        throw new Error("duplicate events should not be inserted");
      },
    };

    const service = createAnalyticsService(store);

    const result = await service.recordAnalyticsEvent({
      eventType: "storefront.checkout_started",
      idempotencyKey: "checkout-started-1",
      source: "storefront",
      tenantId: "tenant_1",
    });

    assert.deepEqual(result, {
      ok: true,
      duplicate: true,
      event: {
        id: "event_existing",
        eventType: "storefront.checkout_started",
        occurredAt: "2026-01-01T12:00:00.000Z",
        receivedAt: "2026-01-01T12:00:01.000Z",
        source: "storefront",
      },
    });
    assert.equal(insertCalls, 0);
  });

  it("rejects unknown storefront event types", async () => {
    const service = createAnalyticsService({
      findEventByIdempotencyKey: async () => null,
      insertEvent: async () => {
        throw new Error("invalid events should not be inserted");
      },
    });

    const result = await service.recordAnalyticsEvent({
      eventType: "tenant.created",
      source: "storefront",
      tenantId: "tenant_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "analytics_event_type_invalid",
      status: 400,
    });
  });
});

describe("createAnalyticsInsightsService", () => {
  it("summarizes tenant analytics events for a bounded range", async () => {
    const calls: {
      from: Date;
      limit?: number;
      tenantId: string;
      to: Date;
    }[] = [];
    const store: AnalyticsInsightsStore = {
      countEventsBySource: async (input) => {
        calls.push(input);

        return [
          { count: 7, source: "storefront" },
          { count: 3, source: "platform" },
          { count: 2, source: "medusa" },
        ];
      },
      countEventsByType: async (input) => {
        calls.push(input);

        return [{ count: 7, eventType: "storefront.page_viewed" }];
      },
      listRecentEvents: async (input) => {
        calls.push(input);

        return [
          {
            customerId: null,
            eventType: "storefront.page_viewed",
            id: "event_1",
            idempotencyKey: null,
            occurredAt: new Date("2026-06-29T10:00:00.000Z"),
            properties: {},
            receivedAt: new Date("2026-06-29T10:00:01.000Z"),
            sessionIdHash: null,
            source: "storefront",
            subjectId: null,
            subjectType: null,
            tenantId: "tenant_1",
          },
        ];
      },
    };
    const service = createAnalyticsInsightsService(store, {
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const result = await service.getTenantInsightsSummary({
      days: 7,
      tenantId: "tenant_1",
    });

    assert.deepEqual(
      calls.map((call) => ({
        ...call,
        from: call.from.toISOString(),
        to: call.to.toISOString(),
      })),
      [
        {
          from: "2026-06-23T00:00:00.000Z",
          tenantId: "tenant_1",
          to: "2026-06-30T00:00:00.000Z",
        },
        {
          from: "2026-06-23T00:00:00.000Z",
          limit: 5,
          tenantId: "tenant_1",
          to: "2026-06-30T00:00:00.000Z",
        },
        {
          from: "2026-06-23T00:00:00.000Z",
          limit: 10,
          tenantId: "tenant_1",
          to: "2026-06-30T00:00:00.000Z",
        },
      ],
    );
    assert.deepEqual(result, {
      ok: true,
      summary: {
        tenantId: "tenant_1",
        range: {
          days: 7,
          from: "2026-06-23T00:00:00.000Z",
          to: "2026-06-30T00:00:00.000Z",
        },
        totals: {
          events: 12,
          medusaEvents: 2,
          platformEvents: 3,
          storefrontEvents: 7,
        },
        topEvents: [
          {
            eventType: "storefront.page_viewed",
            count: 7,
          },
        ],
        recentEvents: [
          {
            id: "event_1",
            eventType: "storefront.page_viewed",
            occurredAt: "2026-06-29T10:00:00.000Z",
            source: "storefront",
            subjectId: null,
            subjectType: null,
          },
        ],
      },
    });
  });
});
