import type { createPlatformDb } from "@ecs/db";
import { auditLogs, paymentOnboarding } from "@ecs/db";
import { and, asc, eq } from "drizzle-orm";

import type {
  PaymentOnboarding,
  PaymentOnboardingListResult,
  PaymentOnboardingSubmitResult,
} from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const allowedOnboardingProviders = new Set(["chapa"]);

function normalizePaymentProvider(value: string) {
  return value.trim().toLowerCase();
}

function selectPaymentOnboardingFields() {
  return {
    id: paymentOnboarding.id,
    provider: paymentOnboarding.provider,
    status: paymentOnboarding.status,
    requiredDocuments: paymentOnboarding.requiredDocuments,
    notes: paymentOnboarding.notes,
    providerAccountRef: paymentOnboarding.providerAccountRef,
  };
}

export function createPaymentOnboardingService(db: PlatformDb) {
  return {
    listPaymentOnboarding: async (input: {
      tenantId: string;
    }): Promise<PaymentOnboardingListResult> => {
      const rows: PaymentOnboarding[] = await db
        .select(selectPaymentOnboardingFields())
        .from(paymentOnboarding)
        .where(eq(paymentOnboarding.tenantId, input.tenantId))
        .orderBy(asc(paymentOnboarding.provider));

      return {
        ok: true,
        paymentOnboarding: rows,
      };
    },
    submitPaymentOnboarding: async (input: {
      notes?: string | null | undefined;
      provider: string;
      requiredDocuments: unknown[];
      tenantId: string;
      userId: string;
    }): Promise<PaymentOnboardingSubmitResult> => {
      const provider = normalizePaymentProvider(input.provider);

      if (!allowedOnboardingProviders.has(provider)) {
        return {
          ok: false,
          error: "payment_provider_invalid",
          status: 400,
        };
      }

      const submitted = await db.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: paymentOnboarding.id })
          .from(paymentOnboarding)
          .where(
            and(
              eq(paymentOnboarding.tenantId, input.tenantId),
              eq(paymentOnboarding.provider, provider),
            ),
          )
          .limit(1);

        const [row] = existing
          ? await transaction
              .update(paymentOnboarding)
              .set({
                requiredDocuments: input.requiredDocuments,
                notes: input.notes ?? null,
                status: "needs_review",
              })
              .where(eq(paymentOnboarding.id, existing.id))
              .returning(selectPaymentOnboardingFields())
          : await transaction
              .insert(paymentOnboarding)
              .values({
                tenantId: input.tenantId,
                provider,
                requiredDocuments: input.requiredDocuments,
                notes: input.notes ?? null,
                status: "needs_review",
              })
              .returning(selectPaymentOnboardingFields());

        if (!row) {
          throw new Error("Payment onboarding write returned no rows.");
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "payment_onboarding.submitted",
          targetType: "payment_onboarding",
          targetId: row.id,
          metadata: {
            provider,
            status: row.status,
          },
        });

        return row;
      });

      return {
        ok: true,
        paymentOnboarding: submitted,
      };
    },
  };
}
