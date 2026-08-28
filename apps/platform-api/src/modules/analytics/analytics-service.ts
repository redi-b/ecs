import { createHash } from "node:crypto";

import type { createPlatformDb } from "@ecs/db";
import { analyticsEvents, type analyticsSource } from "@ecs/db";
import { and, count, countDistinct, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

type AnalyticsSource = (typeof analyticsSource.enumValues)[number];
type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type AnalyticsEventRecordInput = {
  customerId?: string | null | undefined;
  eventType: string;
  idempotencyKey?: string | null | undefined;
  occurredAt?: string | null | undefined;
  properties?: unknown;
  sessionId?: string | null | undefined;
  source: AnalyticsSource;
  subjectId?: string | null | undefined;
  subjectType?: string | null | undefined;
  tenantId: string;
};

export type AnalyticsEventRecordResult =
  | {
      ok: true;
      duplicate: boolean;
      event: {
        id: string;
        eventType: string;
        occurredAt: string;
        receivedAt: string;
        source: AnalyticsSource;
      };
    }
  | {
      ok: false;
      error:
        | "analytics_event_type_invalid"
        | "analytics_event_source_invalid"
        | "analytics_event_timestamp_invalid"
        | "analytics_properties_invalid";
      status: 400;
    };

export type AnalyticsEventStoreInput = {
  customerId: string | null;
  eventType: string;
  idempotencyKey: string | null;
  occurredAt: Date;
  properties: Record<string, unknown>;
  sessionIdHash: string | null;
  source: AnalyticsSource;
  subjectId: string | null;
  subjectType: string | null;
  tenantId: string;
};

export type AnalyticsEventStoreRow = AnalyticsEventStoreInput & {
  id: string;
  receivedAt: Date;
};

export type AnalyticsEventStore = {
  findEventByIdempotencyKey: (input: {
    idempotencyKey: string;
    source: AnalyticsSource;
    tenantId: string;
  }) => Promise<AnalyticsEventStoreRow | null>;
  insertEvent: (input: AnalyticsEventStoreInput) => Promise<AnalyticsEventStoreRow>;
};

export type TenantInsightsSummaryEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
  source: AnalyticsSource;
  subjectId: string | null;
  subjectType: string | null;
};

export type TenantInsightsSummaryResult = {
  ok: true;
  summary: {
    tenantId: string;
    range: {
      days: number;
      from: string;
      to: string;
    };
    totals: {
      events: number;
      medusaEvents: number;
      platformEvents: number;
      storefrontEvents: number;
    };
    topEvents: {
      eventType: string;
      count: number;
    }[];
    funnel: Array<{
      count: number;
      key:
        | "storefront_visits"
        | "product_views"
        | "add_to_cart"
        | "checkout_started"
        | "orders_created";
    }>;
    coverage: {
      lastEventAt: string | null;
      status: "no_data" | "observed";
    };
    recentEvents: TenantInsightsSummaryEvent[];
    storefront?: {
      addToCartVisits: number;
      checkoutVisits: number;
      contactVisits: number;
      pageViews: number;
      productViewVisits: number;
      searchVisits: number;
      visits: number;
    };
    products?: Array<{
      addToCartVisits: number;
      productId: string;
      viewVisits: number;
    }>;
  };
};

export type AnalyticsInsightsStore = {
  countEventsBySource: (input: {
    from: Date;
    tenantId: string;
    to: Date;
  }) => Promise<{ count: number; source: AnalyticsSource }[]>;
  countEventsByType: (input: {
    from: Date;
    limit: number;
    tenantId: string;
    to: Date;
  }) => Promise<{ count: number; eventType: string }[]>;
  countDistinctSessionsByEventType: (input: {
    from: Date;
    tenantId: string;
    to: Date;
  }) => Promise<{ count: number; eventType: string }[]>;
  listRecentEvents: (input: {
    from: Date;
    limit: number;
    tenantId: string;
    to: Date;
  }) => Promise<AnalyticsEventStoreRow[]>;
  countDistinctProductSessions?: (input: {
    from: Date;
    limit: number;
    tenantId: string;
    to: Date;
  }) => Promise<Array<{ count: number; eventType: string; productId: string }>>;
};

const allowedSources = new Set<AnalyticsSource>(["medusa", "platform", "storefront"]);
const allowedStorefrontEvents = new Set([
  "storefront.page_viewed",
  "storefront.product_viewed",
  "storefront.collection_viewed",
  "storefront.search_submitted",
  "storefront.add_to_cart_clicked",
  "storefront.checkout_started",
  "storefront.contact_clicked",
]);

const funnelEvents = [
  { key: "storefront_visits", eventTypes: ["storefront.page_viewed"] },
  { key: "product_views", eventTypes: ["storefront.product_viewed"] },
  { key: "add_to_cart", eventTypes: ["storefront.add_to_cart_clicked"] },
  { key: "checkout_started", eventTypes: ["storefront.checkout_started"] },
  { key: "orders_created", eventTypes: ["order.created"] },
] as const;

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeProperties(value: unknown): Record<string, unknown> | null {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseOccurredAt(value: string | null | undefined) {
  if (!value?.trim()) {
    return new Date();
  }

  const occurredAt = new Date(value);

  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return occurredAt;
}

function hashSessionId(sessionId: string | null | undefined) {
  const normalized = normalizeOptionalText(sessionId);

  if (!normalized) {
    return null;
  }

  return createHash("sha256").update(normalized).digest("hex");
}

function serializeEvent(
  row: AnalyticsEventStoreRow,
  duplicate: boolean,
): AnalyticsEventRecordResult {
  return {
    ok: true,
    duplicate,
    event: {
      id: row.id,
      eventType: row.eventType,
      occurredAt: row.occurredAt.toISOString(),
      receivedAt: row.receivedAt.toISOString(),
      source: row.source,
    },
  };
}

export function createAnalyticsService(store: AnalyticsEventStore) {
  return {
    recordAnalyticsEvent: async (
      input: AnalyticsEventRecordInput,
    ): Promise<AnalyticsEventRecordResult> => {
      const source = input.source;

      if (!allowedSources.has(source)) {
        return {
          ok: false,
          error: "analytics_event_source_invalid",
          status: 400,
        };
      }

      const eventType = input.eventType.trim();

      if (source === "storefront" && !allowedStorefrontEvents.has(eventType)) {
        return {
          ok: false,
          error: "analytics_event_type_invalid",
          status: 400,
        };
      }

      const properties = normalizeProperties(input.properties);

      if (!properties) {
        return {
          ok: false,
          error: "analytics_properties_invalid",
          status: 400,
        };
      }

      const occurredAt = parseOccurredAt(input.occurredAt);

      if (!occurredAt) {
        return {
          ok: false,
          error: "analytics_event_timestamp_invalid",
          status: 400,
        };
      }

      const idempotencyKey = normalizeOptionalText(input.idempotencyKey);

      if (idempotencyKey) {
        const existing = await store.findEventByIdempotencyKey({
          idempotencyKey,
          source,
          tenantId: input.tenantId,
        });

        if (existing) {
          return serializeEvent(existing, true);
        }
      }

      const event = await store.insertEvent({
        customerId: normalizeOptionalText(input.customerId),
        eventType,
        idempotencyKey,
        occurredAt,
        properties,
        sessionIdHash: hashSessionId(input.sessionId),
        source,
        subjectId: normalizeOptionalText(input.subjectId),
        subjectType: normalizeOptionalText(input.subjectType),
        tenantId: input.tenantId,
      });

      return serializeEvent(event, false);
    },
  };
}

export function createAnalyticsInsightsService(
  store: AnalyticsInsightsStore,
  options?: {
    now?: () => Date;
  },
) {
  const now = options?.now ?? (() => new Date());

  return {
    getTenantInsightsSummary: async (input: {
      days: number;
      tenantId: string;
    }): Promise<TenantInsightsSummaryResult> => {
      const to = now();
      const from = new Date(to.getTime() - input.days * 24 * 60 * 60 * 1000);
      const [sourceCounts, eventCounts, sessionCounts, recentEvents, productCounts] =
        await Promise.all([
          store.countEventsBySource({ from, tenantId: input.tenantId, to }),
          store.countEventsByType({ from, limit: 50, tenantId: input.tenantId, to }),
          store.countDistinctSessionsByEventType({ from, tenantId: input.tenantId, to }),
          store.listRecentEvents({ from, limit: 10, tenantId: input.tenantId, to }),
          store.countDistinctProductSessions?.({
            from,
            limit: 20,
            tenantId: input.tenantId,
            to,
          }) ?? Promise.resolve([]),
        ]);
      const totalsBySource = new Map(sourceCounts.map((row) => [row.source, row.count]));
      const countsByType = new Map(eventCounts.map((row) => [row.eventType, row.count]));
      const sessionsByType = new Map(sessionCounts.map((row) => [row.eventType, row.count]));
      const products = new Map<
        string,
        { addToCartVisits: number; productId: string; viewVisits: number }
      >();
      for (const row of productCounts) {
        const product = products.get(row.productId) ?? {
          addToCartVisits: 0,
          productId: row.productId,
          viewVisits: 0,
        };
        if (row.eventType === "storefront.product_viewed") product.viewVisits = row.count;
        if (row.eventType === "storefront.add_to_cart_clicked") product.addToCartVisits = row.count;
        products.set(row.productId, product);
      }

      return {
        ok: true,
        summary: {
          tenantId: input.tenantId,
          range: {
            days: input.days,
            from: from.toISOString(),
            to: to.toISOString(),
          },
          totals: {
            events: sourceCounts.reduce((total, row) => total + row.count, 0),
            medusaEvents: totalsBySource.get("medusa") ?? 0,
            platformEvents: totalsBySource.get("platform") ?? 0,
            storefrontEvents: totalsBySource.get("storefront") ?? 0,
          },
          topEvents: eventCounts.slice(0, 5),
          funnel: funnelEvents.map((stage) => ({
            count: stage.eventTypes.reduce(
              (total, eventType) =>
                total +
                (stage.key === "orders_created"
                  ? (countsByType.get(eventType) ?? 0)
                  : (sessionsByType.get(eventType) ?? 0)),
              0,
            ),
            key: stage.key,
          })),
          storefront: {
            addToCartVisits: sessionsByType.get("storefront.add_to_cart_clicked") ?? 0,
            checkoutVisits: sessionsByType.get("storefront.checkout_started") ?? 0,
            contactVisits: sessionsByType.get("storefront.contact_clicked") ?? 0,
            pageViews: countsByType.get("storefront.page_viewed") ?? 0,
            productViewVisits: sessionsByType.get("storefront.product_viewed") ?? 0,
            searchVisits: sessionsByType.get("storefront.search_submitted") ?? 0,
            visits: sessionsByType.get("storefront.page_viewed") ?? 0,
          },
          products: [...products.values()]
            .sort((left, right) => right.viewVisits - left.viewVisits)
            .slice(0, 10),
          coverage: {
            lastEventAt: recentEvents[0]?.occurredAt.toISOString() ?? null,
            status: sourceCounts.some((row) => row.count > 0) ? "observed" : "no_data",
          },
          recentEvents: recentEvents.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            occurredAt: event.occurredAt.toISOString(),
            source: event.source,
            subjectId: event.subjectId,
            subjectType: event.subjectType,
          })),
        },
      };
    },
  };
}

function serializeAnalyticsEventRow(
  row: typeof analyticsEvents.$inferSelect,
): AnalyticsEventStoreRow {
  return {
    customerId: row.customerId,
    eventType: row.eventType,
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    occurredAt: row.occurredAt,
    properties:
      typeof row.properties === "object" &&
      row.properties !== null &&
      !Array.isArray(row.properties)
        ? (row.properties as Record<string, unknown>)
        : {},
    receivedAt: row.receivedAt,
    sessionIdHash: row.sessionIdHash,
    source: row.source,
    subjectId: row.subjectId,
    subjectType: row.subjectType,
    tenantId: row.tenantId,
  };
}

export function createDrizzleAnalyticsEventStore(db: PlatformDb): AnalyticsEventStore {
  return {
    findEventByIdempotencyKey: async (input) => {
      const [row] = await db
        .select()
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.tenantId, input.tenantId),
            eq(analyticsEvents.source, input.source),
            eq(analyticsEvents.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      return row ? serializeAnalyticsEventRow(row) : null;
    },
    insertEvent: async (input) => {
      const [row] = await db
        .insert(analyticsEvents)
        .values({
          customerId: input.customerId,
          eventType: input.eventType,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
          properties: input.properties,
          sessionIdHash: input.sessionIdHash,
          source: input.source,
          subjectId: input.subjectId,
          subjectType: input.subjectType,
          tenantId: input.tenantId,
        })
        .returning();

      if (!row) {
        throw new Error("Analytics event insert returned no rows.");
      }

      return serializeAnalyticsEventRow(row);
    },
  };
}

export function createDrizzleAnalyticsInsightsStore(db: PlatformDb): AnalyticsInsightsStore {
  return {
    countEventsBySource: async (input) => {
      const eventCount = count();

      return db
        .select({
          source: analyticsEvents.source,
          count: eventCount,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.tenantId, input.tenantId),
            gte(analyticsEvents.occurredAt, input.from),
            lte(analyticsEvents.occurredAt, input.to),
          ),
        )
        .groupBy(analyticsEvents.source);
    },
    countEventsByType: async (input) => {
      const eventCount = count();

      return db
        .select({
          eventType: analyticsEvents.eventType,
          count: eventCount,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.tenantId, input.tenantId),
            gte(analyticsEvents.occurredAt, input.from),
            lte(analyticsEvents.occurredAt, input.to),
          ),
        )
        .groupBy(analyticsEvents.eventType)
        .orderBy(desc(eventCount))
        .limit(input.limit);
    },
    countDistinctSessionsByEventType: async (input) => {
      const sessionCount = countDistinct(analyticsEvents.sessionIdHash);

      return db
        .select({
          eventType: analyticsEvents.eventType,
          count: sessionCount,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.tenantId, input.tenantId),
            eq(analyticsEvents.source, "storefront"),
            isNotNull(analyticsEvents.sessionIdHash),
            gte(analyticsEvents.occurredAt, input.from),
            lte(analyticsEvents.occurredAt, input.to),
          ),
        )
        .groupBy(analyticsEvents.eventType);
    },
    listRecentEvents: async (input) => {
      const rows = await db
        .select()
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.tenantId, input.tenantId),
            gte(analyticsEvents.occurredAt, input.from),
            lte(analyticsEvents.occurredAt, input.to),
          ),
        )
        .orderBy(desc(analyticsEvents.occurredAt))
        .limit(input.limit);

      return rows.map(serializeAnalyticsEventRow);
    },
    countDistinctProductSessions: async (input) => {
      const sessionCount = countDistinct(analyticsEvents.sessionIdHash);
      return db
        .select({
          count: sessionCount,
          eventType: analyticsEvents.eventType,
          productId: analyticsEvents.subjectId,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.tenantId, input.tenantId),
            eq(analyticsEvents.source, "storefront"),
            eq(analyticsEvents.subjectType, "product"),
            inArray(analyticsEvents.eventType, [
              "storefront.product_viewed",
              "storefront.add_to_cart_clicked",
            ]),
            isNotNull(analyticsEvents.subjectId),
            isNotNull(analyticsEvents.sessionIdHash),
            gte(analyticsEvents.occurredAt, input.from),
            lte(analyticsEvents.occurredAt, input.to),
          ),
        )
        .groupBy(analyticsEvents.subjectId, analyticsEvents.eventType)
        .orderBy(desc(sessionCount))
        .limit(input.limit)
        .then((rows) =>
          rows.flatMap((row) =>
            row.productId
              ? [{ count: row.count, eventType: row.eventType, productId: row.productId }]
              : [],
          ),
        );
    },
  };
}
