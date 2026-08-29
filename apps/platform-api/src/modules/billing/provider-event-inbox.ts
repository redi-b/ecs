import type { createPlatformDb } from "@ecs/db";
import { billingProviderEvents } from "@ecs/db";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type VerifiedBillingPaymentEvent = {
  providerReference: string | null;
  tenantId: string;
  txRef: string;
};

type CompletePayment = (
  input: VerifiedBillingPaymentEvent,
) => Promise<{ ok: true; applied: boolean } | { ok: false; error: string }>;

const PROCESSING_LEASE_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

function retryAt(attempts: number, now = new Date()) {
  const delay = Math.min(2 ** Math.max(attempts - 1, 0) * 5_000, MAX_RETRY_DELAY_MS);
  return new Date(now.getTime() + delay);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 2_000);
  if (typeof error === "string") return error.slice(0, 2_000);
  return "billing_provider_event_processing_failed";
}

function paymentPayload(value: unknown): VerifiedBillingPaymentEvent | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.tenantId !== "string" || typeof payload.txRef !== "string") return null;
  return {
    providerReference:
      typeof payload.providerReference === "string" ? payload.providerReference : null,
    tenantId: payload.tenantId,
    txRef: payload.txRef,
  };
}

/**
 * A small transactional inbox around verified provider facts. Verification is
 * intentionally outside this module; only a trusted adapter may record events.
 */
export function createBillingProviderEventInbox(db: PlatformDb, completePayment: CompletePayment) {
  async function record(input: VerifiedBillingPaymentEvent) {
    const eventKey = `payment-success:${input.txRef}`;
    await db
      .insert(billingProviderEvents)
      .values({
        provider: "chapa",
        eventKey,
        eventType: "billing.payment.verified_success",
        tenantId: input.tenantId,
        payload: input,
      })
      .onConflictDoNothing({
        target: [billingProviderEvents.provider, billingProviderEvents.eventKey],
      });

    const [event] = await db
      .select({ id: billingProviderEvents.id, status: billingProviderEvents.status })
      .from(billingProviderEvents)
      .where(
        and(
          eq(billingProviderEvents.provider, "chapa"),
          eq(billingProviderEvents.eventKey, eventKey),
        ),
      )
      .limit(1);

    if (!event) throw new Error("billing_provider_event_not_recorded");
    return event;
  }

  async function processEvent(eventId: string) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const [claimed] = await db
      .update(billingProviderEvents)
      .set({
        attempts: sql`${billingProviderEvents.attempts} + 1`,
        lastError: null,
        processingStartedAt: now,
        status: "processing",
        updatedAt: now,
      })
      .where(
        and(
          eq(billingProviderEvents.id, eventId),
          or(
            and(
              inArray(billingProviderEvents.status, ["pending", "failed"]),
              lte(billingProviderEvents.nextAttemptAt, now),
            ),
            and(
              eq(billingProviderEvents.status, "processing"),
              lte(billingProviderEvents.processingStartedAt, staleBefore),
            ),
          ),
        ),
      )
      .returning({
        attempts: billingProviderEvents.attempts,
        payload: billingProviderEvents.payload,
      });

    if (!claimed) return { kind: "not_claimed" as const };

    try {
      const payload = paymentPayload(claimed.payload);
      if (!payload) throw new Error("billing_provider_event_payload_invalid");
      const result = await completePayment(payload);
      if (!result.ok) throw new Error(result.error);

      await db
        .update(billingProviderEvents)
        .set({
          lastError: null,
          processedAt: new Date(),
          processingStartedAt: null,
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(billingProviderEvents.id, eventId));
      return { kind: "completed" as const, applied: result.applied };
    } catch (error) {
      const failedAt = new Date();
      await db
        .update(billingProviderEvents)
        .set({
          lastError: errorMessage(error),
          nextAttemptAt: retryAt(claimed.attempts, failedAt),
          processingStartedAt: null,
          status: "failed",
          updatedAt: failedAt,
        })
        .where(eq(billingProviderEvents.id, eventId));
      return { kind: "failed" as const };
    }
  }

  return {
    recordVerifiedPayment: record,

    recordAndProcessVerifiedPayment: async (input: VerifiedBillingPaymentEvent) => {
      const event = await record(input);
      if (event.status === "completed") return { kind: "completed" as const, applied: false };
      return processEvent(event.id);
    },

    processDue: async (input?: { limit?: number }) => {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
      const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
      const candidates = await db
        .select({ id: billingProviderEvents.id })
        .from(billingProviderEvents)
        .where(
          or(
            and(
              inArray(billingProviderEvents.status, ["pending", "failed"]),
              lte(billingProviderEvents.nextAttemptAt, now),
            ),
            and(
              eq(billingProviderEvents.status, "processing"),
              lte(billingProviderEvents.processingStartedAt, staleBefore),
            ),
          ),
        )
        .orderBy(asc(billingProviderEvents.nextAttemptAt))
        .limit(limit);

      let completed = 0;
      let failed = 0;
      for (const candidate of candidates) {
        const result = await processEvent(candidate.id);
        if (result.kind === "completed") completed += 1;
        if (result.kind === "failed") failed += 1;
      }
      return { scanned: candidates.length, completed, failed };
    },
  };
}
