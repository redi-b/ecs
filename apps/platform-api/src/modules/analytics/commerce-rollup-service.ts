import type { createPlatformDb } from "@ecs/db";
import { dailyMetrics, metricRollupCheckpoints } from "@ecs/db";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import type { MerchantOrdersResult } from "../../types/index.js";
import type { MerchantOrderListQuery } from "../../types/merchant-order.js";
import {
  COMMERCE_ROLLUP_KEY,
  COMMERCE_ROLLUP_VERSION,
  type CommerceRollupRow,
  computeCommerceDailyRollup,
  DEFAULT_REPORTING_CURRENCY,
  DEFAULT_REPORTING_TIMEZONE,
} from "./commerce-rollup.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const PAGE_SIZE = 100;
export const MAX_COMMERCE_ROLLUP_ORDERS = 10_000;
const commerceMetricKeys = [
  "overview.revenue",
  "overview.orders",
  "overview.customers",
  "overview.customers.unique",
  "overview.customers.repeat",
];

export type ListOrdersForRollup = (input: MerchantOrderListQuery) => Promise<MerchantOrdersResult>;

export type CommerceRollupWriteInput = {
  currencyCode: string;
  from: Date;
  rows: CommerceRollupRow[];
  tenantId: string;
  timezone: string;
  to: Date;
  watermark: Date;
};

export type WriteCommerceRollup = (input: CommerceRollupWriteInput) => Promise<void>;

export async function runCommerceRollup(input: {
  currencyCode?: string | undefined;
  from: Date;
  listOrders: ListOrdersForRollup;
  salesChannelId: string;
  tenantId: string;
  timezone?: string | undefined;
  to: Date;
  writeRollup: WriteCommerceRollup;
}) {
  if (
    Number.isNaN(input.from.getTime()) ||
    Number.isNaN(input.to.getTime()) ||
    input.from >= input.to
  ) {
    return { ok: false as const, error: "commerce_rollup_range_invalid", status: 400 };
  }

  const orders = [];
  let offset = 0;
  let count: number | null = null;
  do {
    const page = await input.listOrders({
      createdFrom: input.from.toISOString(),
      createdTo: input.to.toISOString(),
      limit: PAGE_SIZE,
      offset,
      salesChannelId: input.salesChannelId,
    });
    if (!page.ok) return page;
    count ??= page.count;
    if (count > MAX_COMMERCE_ROLLUP_ORDERS) {
      return { ok: false as const, error: "commerce_rollup_too_large", status: 413 };
    }
    orders.push(...page.orders);
    offset += page.orders.length;
    if (page.orders.length === 0) break;
  } while (offset < (count ?? 0));

  const rollup = computeCommerceDailyRollup({
    currencyCode: input.currencyCode ?? DEFAULT_REPORTING_CURRENCY,
    orders,
    timezone: input.timezone ?? DEFAULT_REPORTING_TIMEZONE,
  });
  if (!rollup.ok) return { ...rollup, status: 422 as const };

  await input.writeRollup({
    currencyCode: rollup.currencyCode,
    from: input.from,
    rows: rollup.rows,
    tenantId: input.tenantId,
    timezone: rollup.timezone,
    to: input.to,
    watermark: input.to,
  });

  return {
    ok: true as const,
    rowCount: rollup.rows.length,
    sourceOrderCount: rollup.sourceOrderCount,
    watermark: input.to.toISOString(),
  };
}

export function createCommerceRollupWriter(db: PlatformDb): WriteCommerceRollup {
  return async (input) => {
    await db.transaction(async (transaction) => {
      const fromDate = localDate(input.from, input.timezone);
      const toDate = localDate(new Date(input.to.getTime() - 1), input.timezone);
      await transaction
        .delete(dailyMetrics)
        .where(
          and(
            eq(dailyMetrics.tenantId, input.tenantId),
            gte(dailyMetrics.date, fromDate),
            lte(dailyMetrics.date, toDate),
            inArray(dailyMetrics.metricKey, commerceMetricKeys),
            eq(dailyMetrics.rollupVersion, COMMERCE_ROLLUP_VERSION),
          ),
        );

      if (input.rows.length) {
        await transaction.insert(dailyMetrics).values(
          input.rows.map((row) => ({
            ...row,
            computedAt: new Date(),
            rollupVersion: COMMERCE_ROLLUP_VERSION,
            sourceWindowEnd: input.to,
            sourceWindowStart: input.from,
            tenantId: input.tenantId,
            timezone: input.timezone,
            value: String(row.value),
          })),
        );
      }

      const now = new Date();
      await transaction
        .insert(metricRollupCheckpoints)
        .values({
          lastSuccessfulAt: now,
          metadata: {
            currencyCode: input.currencyCode,
            rowCount: input.rows.length,
          },
          rollupKey: COMMERCE_ROLLUP_KEY,
          rollupVersion: COMMERCE_ROLLUP_VERSION,
          tenantId: input.tenantId,
          timezone: input.timezone,
          updatedAt: now,
          watermark: input.watermark,
        })
        .onConflictDoUpdate({
          target: [
            metricRollupCheckpoints.tenantId,
            metricRollupCheckpoints.rollupKey,
            metricRollupCheckpoints.rollupVersion,
          ],
          set: {
            lastSuccessfulAt: now,
            metadata: {
              currencyCode: input.currencyCode,
              rowCount: input.rows.length,
            },
            timezone: input.timezone,
            updatedAt: now,
            watermark: input.watermark,
          },
        });
    });
  };
}

function localDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(value);
}
