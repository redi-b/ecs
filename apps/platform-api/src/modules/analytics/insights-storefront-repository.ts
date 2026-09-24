import { analyticsEvents, type createPlatformDb } from "@ecs/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { reportingDayStart, shiftReportingDay } from "./reporting-calendar.js";
import { STOREFRONT_STAGE_EVENTS, type ReadStorefrontReport } from "./insights-storefront.js";

export function createStorefrontReportReader(
  db: ReturnType<typeof createPlatformDb>["db"],
): ReadStorefrontReport {
  return ({ tenantId, query, previousRange }) =>
    db.transaction(
      async (tx) => {
        const currentFrom = reportingDayStart(query.from);
        const end = reportingDayStart(shiftReportingDay(query.to, 1));
        const start = reportingDayStart(previousRange?.from ?? query.from);
        const scope = and(
          eq(analyticsEvents.tenantId, tenantId),
          eq(analyticsEvents.source, "storefront"),
          gte(analyticsEvents.occurredAt, start),
          lt(analyticsEvents.occurredAt, end),
        );
        const current = sql`${analyticsEvents.occurredAt} >= ${currentFrom}`;
        const stages = await tx
          .select({
            eventType: analyticsEvents.eventType,
            sessions: sql<string>`count(distinct ${analyticsEvents.sessionIdHash}) filter (where ${current})`,
            previousSessions: sql<string>`count(distinct ${analyticsEvents.sessionIdHash}) filter (where not (${current}))`,
          })
          .from(analyticsEvents)
          .where(scope)
          .groupBy(analyticsEvents.eventType);
        const totals = await tx
          .select({
            events: sql<string>`count(*) filter (where ${current})`,
            missing: sql<string>`count(*) filter (where ${current} and ${analyticsEvents.sessionIdHash} is null)`,
          })
          .from(analyticsEvents)
          .where(scope);
        // Never return query strings, fragments, external URLs or search terms to report consumers.
        const path = sql<string>`case when ${analyticsEvents.properties}->>'path' like '/%' and ${analyticsEvents.properties}->>'path' not like '//%' then split_part(split_part(${analyticsEvents.properties}->>'path', '?', 1), '#', 1) else '' end`;
        const grouped = tx
          .select({
            path: path.as("path"),
            sessions: sql<string>`count(distinct ${analyticsEvents.sessionIdHash})`.as("sessions"),
          })
          .from(analyticsEvents)
          .where(
            and(
              scope,
              gte(analyticsEvents.occurredAt, currentFrom),
              eq(analyticsEvents.eventType, STOREFRONT_STAGE_EVENTS[query.stage]),
              sql`${analyticsEvents.sessionIdHash} is not null`,
            ),
          )
          .groupBy(path)
          .as("paths");
        const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
        const filter = query.q ? sql`${grouped.path} ilike ${pattern}` : undefined;
        const counts = await tx
          .select({ count: sql<string>`count(*)` })
          .from(grouped)
          .where(filter);
        const rows = await tx
          .select()
          .from(grouped)
          .where(filter)
          .orderBy(sql`${grouped.sessions} desc`, grouped.path)
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize);
        return {
          stages: stages.map((row) => ({
            ...row,
            sessions: Number(row.sessions),
            previousSessions: Number(row.previousSessions),
          })),
          recordedEvents: Number(totals[0]?.events ?? 0),
          eventsWithoutSession: Number(totals[0]?.missing ?? 0),
          count: Number(counts[0]?.count ?? 0),
          rows: rows.map((row) => ({ ...row, sessions: Number(row.sessions) })),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
}
