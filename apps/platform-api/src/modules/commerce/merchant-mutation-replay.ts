import { createHash } from "node:crypto";
import type { MerchantOperationChannel } from "@ecs/contracts";
import {
  auditLogs,
  type createPlatformDb,
  merchantMutationExecutions,
  merchantMutationLocks,
} from "@ecs/db";
import { and, eq } from "drizzle-orm";

export type MerchantMutationOperation =
  | "assisted_sale.create"
  | "inventory.stock.batch"
  | "inventory.stock.set"
  | "order.mark_paid"
  | "order.refund"
  | "sale_draft.delete"
  | "sale_draft.save";

export type MerchantMutationEnvelope = {
  actorUserId: string;
  idempotencyKey: string;
  operation: MerchantMutationOperation;
  payload: unknown;
  requestId: string;
  resourceKeys: string[];
  source: MerchantOperationChannel;
  tenantId: string;
};

export type MerchantMutationExecutionResult<T> =
  | { ok: true; replayed: boolean; value: T }
  | {
      ok: false;
      error: "idempotency_conflict" | "mutation_in_progress" | "mutation_repair_required";
      status: 409;
    };

type StoredMutation = {
  payloadHash: string;
  state: "processing" | "completed" | "failed";
  value?: unknown;
};

export type MerchantMutationStore = {
  claim(
    input: MerchantMutationEnvelope & {
      payloadHash: string;
    },
  ): Promise<
    | { kind: "claimed" }
    | { kind: "completed"; value: unknown }
    | { kind: "conflict" }
    | { kind: "failed" }
    | { kind: "processing" }
    | { kind: "resource_conflict" }
  >;
  complete(input: {
    idempotencyKey: string;
    operation: MerchantMutationOperation;
    tenantId: string;
    value: unknown;
  }): Promise<void>;
  fail(input: {
    idempotencyKey: string;
    operation: MerchantMutationOperation;
    tenantId: string;
  }): Promise<void>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}

export function hashMerchantMutationPayload(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

export function createInMemoryMerchantMutationStore(): MerchantMutationStore {
  const mutations = new Map<string, StoredMutation>();
  const locks = new Map<string, string>();
  const keyFor = (input: {
    idempotencyKey: string;
    operation: MerchantMutationOperation;
    tenantId: string;
  }) => `${input.tenantId}:${input.operation}:${input.idempotencyKey}`;

  return {
    async claim(input) {
      const key = keyFor(input);
      const existing = mutations.get(key);
      if (!existing) {
        if (
          input.resourceKeys.some((resourceKey) => locks.has(`${input.tenantId}:${resourceKey}`))
        ) {
          return { kind: "resource_conflict" };
        }
        mutations.set(key, { payloadHash: input.payloadHash, state: "processing" });
        for (const resourceKey of input.resourceKeys) {
          locks.set(`${input.tenantId}:${resourceKey}`, key);
        }
        return { kind: "claimed" };
      }
      if (existing.payloadHash !== input.payloadHash) return { kind: "conflict" };
      if (existing.state === "processing") return { kind: "processing" };
      if (existing.state === "failed") return { kind: "failed" };
      return { kind: "completed", value: existing.value };
    },
    async complete(input) {
      const key = keyFor(input);
      const existing = mutations.get(key);
      if (!existing) throw new Error("Cannot complete an unclaimed merchant mutation.");
      mutations.set(key, { ...existing, state: "completed", value: input.value });
      for (const [lockKey, owner] of locks) {
        if (owner === key) locks.delete(lockKey);
      }
    },
    async fail(input) {
      const key = keyFor(input);
      const existing = mutations.get(key);
      if (!existing) throw new Error("Cannot fail an unclaimed merchant mutation.");
      mutations.set(key, { ...existing, state: "failed" });
    },
  };
}

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];

export function createPostgresMerchantMutationStore(db: PlatformDatabase): MerchantMutationStore {
  const match = (input: {
    idempotencyKey: string;
    operation: MerchantMutationOperation;
    tenantId: string;
  }) =>
    and(
      eq(merchantMutationExecutions.tenantId, input.tenantId),
      eq(merchantMutationExecutions.operation, input.operation),
      eq(merchantMutationExecutions.idempotencyKey, input.idempotencyKey),
    );

  return {
    async claim(input) {
      let created: { id: string } | undefined;
      try {
        created = await db.transaction(async (transaction) => {
          const [execution] = await transaction
            .insert(merchantMutationExecutions)
            .values({
              actorUserId: input.actorUserId,
              idempotencyKey: input.idempotencyKey,
              operation: input.operation,
              payloadHash: input.payloadHash,
              requestId: input.requestId,
              source: input.source,
              tenantId: input.tenantId,
            })
            .onConflictDoNothing()
            .returning({ id: merchantMutationExecutions.id });
          if (!execution) return undefined;
          const acquired = await transaction
            .insert(merchantMutationLocks)
            .values(
              input.resourceKeys.map((resourceKey) => ({
                idempotencyKey: input.idempotencyKey,
                operation: input.operation,
                resourceKey,
                tenantId: input.tenantId,
              })),
            )
            .onConflictDoNothing()
            .returning({ id: merchantMutationLocks.id });
          if (acquired.length !== input.resourceKeys.length) {
            throw new MerchantMutationResourceConflict();
          }
          return execution;
        });
      } catch (error) {
        if (error instanceof MerchantMutationResourceConflict) {
          return { kind: "resource_conflict" };
        }
        throw error;
      }
      if (created) return { kind: "claimed" };

      const [existing] = await db
        .select({
          payloadHash: merchantMutationExecutions.payloadHash,
          result: merchantMutationExecutions.result,
          state: merchantMutationExecutions.state,
        })
        .from(merchantMutationExecutions)
        .where(match(input))
        .limit(1);
      if (!existing || existing.payloadHash !== input.payloadHash) return { kind: "conflict" };
      if (existing.state === "completed") return { kind: "completed", value: existing.result };
      if (existing.state === "failed") return { kind: "failed" };
      return { kind: "processing" };
    },
    async complete(input) {
      await db.transaction(async (transaction) => {
        await transaction
          .update(merchantMutationExecutions)
          .set({ result: input.value, state: "completed", updatedAt: new Date() })
          .where(match(input));
        await transaction
          .delete(merchantMutationLocks)
          .where(
            and(
              eq(merchantMutationLocks.tenantId, input.tenantId),
              eq(merchantMutationLocks.operation, input.operation),
              eq(merchantMutationLocks.idempotencyKey, input.idempotencyKey),
            ),
          );
        const [execution] = await transaction
          .select({
            actorUserId: merchantMutationExecutions.actorUserId,
            requestId: merchantMutationExecutions.requestId,
            source: merchantMutationExecutions.source,
          })
          .from(merchantMutationExecutions)
          .where(match(input))
          .limit(1);
        if (execution) {
          await transaction.insert(auditLogs).values({
            action: input.operation,
            actorUserId: execution.actorUserId,
            metadata: {
              idempotencyKey: input.idempotencyKey,
              requestId: execution.requestId,
              source: execution.source,
            },
            outcome: "completed",
            targetType: getMutationAuditTargetType(input.operation),
            tenantId: input.tenantId,
          });
        }
      });
    },
    async fail(input) {
      await db
        .update(merchantMutationExecutions)
        .set({ failureCode: "mutation_outcome_unknown", state: "failed", updatedAt: new Date() })
        .where(match(input));
    },
  };
}

export function createMerchantMutationReplayService(input: { store: MerchantMutationStore }) {
  return {
    async execute<T>(
      envelope: MerchantMutationEnvelope,
      mutation: () => Promise<T>,
    ): Promise<MerchantMutationExecutionResult<T>> {
      const identity = {
        actorUserId: envelope.actorUserId,
        idempotencyKey: envelope.idempotencyKey,
        operation: envelope.operation,
        payloadHash: hashMerchantMutationPayload(envelope.payload),
        payload: envelope.payload,
        requestId: envelope.requestId,
        resourceKeys: [...new Set(envelope.resourceKeys)].sort(),
        source: envelope.source,
        tenantId: envelope.tenantId,
      };
      const claim = await input.store.claim(identity);
      if (claim.kind === "conflict") {
        return { ok: false, error: "idempotency_conflict", status: 409 };
      }
      if (claim.kind === "processing" || claim.kind === "resource_conflict") {
        return { ok: false, error: "mutation_in_progress", status: 409 };
      }
      if (claim.kind === "failed") {
        return { ok: false, error: "mutation_repair_required", status: 409 };
      }
      if (claim.kind === "completed") {
        return { ok: true, replayed: true, value: claim.value as T };
      }

      try {
        const value = await mutation();
        await input.store.complete({ ...identity, value });
        return { ok: true, replayed: false, value };
      } catch (error) {
        await input.store.fail(identity);
        throw error;
      }
    },
  };
}

class MerchantMutationResourceConflict extends Error {}

function getMutationAuditTargetType(operation: MerchantMutationOperation) {
  if (operation === "order.refund") return "order_refund";
  if (operation.startsWith("inventory.")) return "inventory_stock";
  if (operation.startsWith("sale_draft.")) return "sale_draft";
  return "order";
}
