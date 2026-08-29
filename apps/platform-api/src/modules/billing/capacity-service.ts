import type { AccountId, EntitlementDecision, Reservation, ReservationId } from "@ecs/billing";
import { decideCapability } from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import { capabilityReservations, capabilityUsage } from "@ecs/db";
import { and, eq, gt, sql } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type CapacityError =
  | "capacity_invalid"
  | "capacity_reservation_not_found"
  | "capacity_reservation_unavailable";

function scopeKey(input: { capability: string; tenantId: string; windowKey: string }) {
  return `${input.tenantId}\u0000${input.capability}\u0000${input.windowKey}`;
}

function toReservation(row: typeof capabilityReservations.$inferSelect): Reservation {
  return {
    accountId: row.tenantId as AccountId,
    amount: row.amount,
    capability: row.key,
    expiresAt: row.expiresAt,
    id: row.id as ReservationId,
    status:
      row.status === "committed" || row.status === "released" || row.status === "expired"
        ? row.status
        : "active",
  };
}

export function createPostgresCapacityService(db: PlatformDb) {
  return {
    reserve: async (input: {
      amount: number;
      capability: string;
      idempotencyKey: string;
      limit: number;
      observedUsage?: number;
      subscriptionStatus: string | null;
      tenantId: string;
      ttlSeconds: number;
      windowKey: string;
    }): Promise<
      | {
          ok: true;
          decision: EntitlementDecision;
          replayed: boolean;
          reservation: Reservation | null;
        }
      | { ok: false; error: "capacity_invalid" }
    > => {
      if (
        !Number.isSafeInteger(input.amount) ||
        input.amount <= 0 ||
        !Number.isSafeInteger(input.limit) ||
        input.limit < 0 ||
        (input.observedUsage !== undefined &&
          (!Number.isSafeInteger(input.observedUsage) || input.observedUsage < 0)) ||
        !Number.isSafeInteger(input.ttlSeconds) ||
        input.ttlSeconds < 1 ||
        !input.capability.trim() ||
        !input.idempotencyKey.trim() ||
        !input.windowKey.trim()
      ) {
        return { ok: false, error: "capacity_invalid" };
      }

      return db.transaction(async (transaction) => {
        const scope = scopeKey(input);
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope}, 0))`);
        const [existing] = await transaction
          .select()
          .from(capabilityReservations)
          .where(
            and(
              eq(capabilityReservations.tenantId, input.tenantId),
              eq(capabilityReservations.key, input.capability),
              eq(capabilityReservations.windowKey, input.windowKey),
              eq(capabilityReservations.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        if (existing) {
          return {
            ok: true as const,
            decision: {
              allowed: existing.status === "active" || existing.status === "committed",
              capability: input.capability,
              reason:
                existing.status === "active" || existing.status === "committed"
                  ? "limit_available"
                  : "limit_exhausted",
              remaining: null,
              source: "plan",
            },
            replayed: true,
            reservation: toReservation(existing),
          };
        }

        const now = new Date();
        await transaction
          .update(capabilityReservations)
          .set({ status: "expired", releasedAt: now })
          .where(
            and(
              eq(capabilityReservations.tenantId, input.tenantId),
              eq(capabilityReservations.key, input.capability),
              eq(capabilityReservations.windowKey, input.windowKey),
              eq(capabilityReservations.status, "active"),
              sql`${capabilityReservations.expiresAt} <= ${now}`,
            ),
          );

        if (input.observedUsage !== undefined) {
          await transaction
            .insert(capabilityUsage)
            .values({
              tenantId: input.tenantId,
              key: input.capability,
              windowKey: input.windowKey,
              consumed: input.observedUsage,
            })
            .onConflictDoUpdate({
              target: [capabilityUsage.tenantId, capabilityUsage.key, capabilityUsage.windowKey],
              set: { consumed: input.observedUsage, updatedAt: now },
            });
        }

        const [usage] = await transaction
          .select({ consumed: capabilityUsage.consumed })
          .from(capabilityUsage)
          .where(
            and(
              eq(capabilityUsage.tenantId, input.tenantId),
              eq(capabilityUsage.key, input.capability),
              eq(capabilityUsage.windowKey, input.windowKey),
            ),
          )
          .limit(1);
        const [active] = await transaction
          .select({ total: sql<number>`coalesce(sum(${capabilityReservations.amount}), 0)::int` })
          .from(capabilityReservations)
          .where(
            and(
              eq(capabilityReservations.tenantId, input.tenantId),
              eq(capabilityReservations.key, input.capability),
              eq(capabilityReservations.windowKey, input.windowKey),
              eq(capabilityReservations.status, "active"),
              gt(capabilityReservations.expiresAt, now),
            ),
          );
        const decision = decideCapability({
          amount: input.amount,
          capability: input.capability,
          definition: { kind: "limit", defaultValue: 0, window: "lifetime" },
          reserved: active?.total ?? 0,
          status: input.subscriptionStatus,
          used: usage?.consumed ?? 0,
          value: input.limit,
        });
        if (!decision.allowed) {
          return { ok: true as const, decision, replayed: false, reservation: null };
        }
        const [created] = await transaction
          .insert(capabilityReservations)
          .values({
            tenantId: input.tenantId,
            key: input.capability,
            windowKey: input.windowKey,
            amount: input.amount,
            idempotencyKey: input.idempotencyKey,
            expiresAt: new Date(now.getTime() + input.ttlSeconds * 1_000),
          })
          .returning();
        if (!created) throw new Error("Capacity reservation insert returned no row.");
        return {
          ok: true as const,
          decision,
          replayed: false,
          reservation: toReservation(created),
        };
      });
    },

    commit: async (reservationId: string) =>
      db.transaction(async (transaction) => {
        const [initial] = await transaction
          .select()
          .from(capabilityReservations)
          .where(eq(capabilityReservations.id, reservationId))
          .limit(1);
        if (!initial) {
          return { ok: false as const, error: "capacity_reservation_not_found" as const };
        }
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${scopeKey({ capability: initial.key, tenantId: initial.tenantId, windowKey: initial.windowKey })}, 0))`,
        );
        const [current] = await transaction
          .select()
          .from(capabilityReservations)
          .where(eq(capabilityReservations.id, reservationId))
          .limit(1);
        if (!current) {
          return { ok: false as const, error: "capacity_reservation_not_found" as const };
        }
        if (current.status === "committed") {
          return { ok: true as const, replayed: true, reservation: toReservation(current) };
        }
        const now = new Date();
        if (current.status !== "active" || current.expiresAt <= now) {
          if (current.status === "active") {
            await transaction
              .update(capabilityReservations)
              .set({ status: "expired", releasedAt: now })
              .where(eq(capabilityReservations.id, current.id));
          }
          return { ok: false as const, error: "capacity_reservation_unavailable" as const };
        }
        await transaction
          .insert(capabilityUsage)
          .values({
            tenantId: current.tenantId,
            key: current.key,
            windowKey: current.windowKey,
            consumed: current.amount,
          })
          .onConflictDoUpdate({
            target: [capabilityUsage.tenantId, capabilityUsage.key, capabilityUsage.windowKey],
            set: {
              consumed: sql`${capabilityUsage.consumed} + ${current.amount}`,
              updatedAt: now,
            },
          });
        const [committed] = await transaction
          .update(capabilityReservations)
          .set({ status: "committed", committedAt: now })
          .where(
            and(
              eq(capabilityReservations.id, current.id),
              eq(capabilityReservations.status, "active"),
            ),
          )
          .returning();
        if (!committed) throw new Error("Capacity reservation commit lost its lock.");
        return { ok: true as const, replayed: false, reservation: toReservation(committed) };
      }),

    release: async (reservationId: string) => {
      const [released] = await db
        .update(capabilityReservations)
        .set({ status: "released", releasedAt: new Date() })
        .where(
          and(
            eq(capabilityReservations.id, reservationId),
            eq(capabilityReservations.status, "active"),
          ),
        )
        .returning();
      if (released)
        return { ok: true as const, replayed: false, reservation: toReservation(released) };
      const [existing] = await db
        .select()
        .from(capabilityReservations)
        .where(eq(capabilityReservations.id, reservationId))
        .limit(1);
      if (!existing) {
        return { ok: false as const, error: "capacity_reservation_not_found" as const };
      }
      if (existing.status === "released") {
        return { ok: true as const, replayed: true, reservation: toReservation(existing) };
      }
      return { ok: false as const, error: "capacity_reservation_unavailable" as const };
    },
  };
}
