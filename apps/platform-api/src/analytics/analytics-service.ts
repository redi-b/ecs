import { createHash } from "node:crypto";

import type { createPlatformDb } from "@ecs/db";
import { analyticsEvents, type analyticsSource } from "@ecs/db";
import { and, eq } from "drizzle-orm";

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
