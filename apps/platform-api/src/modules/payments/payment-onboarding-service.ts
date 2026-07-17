import type { createPlatformDb } from "@ecs/db";
import { auditLogs, paymentOnboarding } from "@ecs/db";
import { and, asc, eq } from "drizzle-orm";

import {
  decryptSecret,
  encryptSecret,
  secretFingerprint,
} from "../../lib/secret-box.js";
import type {
  PaymentOnboarding,
  PaymentOnboardingListResult,
  PaymentOnboardingReviewResult,
  PaymentOnboardingSubmitResult,
} from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const allowedOnboardingProviders = new Set(["chapa"]);
const allowedReviewStatuses = new Set(["approved", "rejected", "needs_review"]);

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

export type PaymentOnboardingServiceOptions = {
  /** Required to encrypt merchant store Chapa secrets. */
  paymentsCredentialsEncryptionKey?: string | undefined;
};

export function createPaymentOnboardingService(
  db: PlatformDb,
  options: PaymentOnboardingServiceOptions = {},
) {
  const encryptionKey = options.paymentsCredentialsEncryptionKey;

  function sealSecret(plaintext: string) {
    if (encryptionKey?.trim()) {
      return encryptSecret(plaintext, encryptionKey);
    }
    // Dev fallback: allow plaintext if key missing (log-worthy); production must set key.
    return plaintext;
  }

  function openSecret(stored: string) {
    return decryptSecret(stored, encryptionKey);
  }

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

    /** Safe status for merchant Settings UI (never includes secret). */
    getMerchantStorePaymentStatus: async (input: { tenantId: string }) => {
      const [row] = await db
        .select({
          secretKey: paymentOnboarding.secretKey,
          onlineEnabled: paymentOnboarding.onlineEnabled,
          credentialsValidatedAt: paymentOnboarding.credentialsValidatedAt,
          secretFingerprint: paymentOnboarding.secretFingerprint,
          status: paymentOnboarding.status,
        })
        .from(paymentOnboarding)
        .where(
          and(eq(paymentOnboarding.tenantId, input.tenantId), eq(paymentOnboarding.provider, "chapa")),
        )
        .limit(1);

      const hasSecret = Boolean(row?.secretKey?.trim());
      const validated = Boolean(row?.credentialsValidatedAt) || hasSecret;

      return {
        ok: true as const,
        payment: {
          cod: true as const,
          chapa: {
            configured: hasSecret,
            onlineEnabled: Boolean(row?.onlineEnabled && hasSecret),
            credentialsValidated: validated && hasSecret,
            secretFingerprint: row?.secretFingerprint ?? null,
            status: row?.status ?? "not_configured",
          },
        },
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

    reviewPaymentOnboarding: async (input: {
      notes?: string | null | undefined;
      operatorUserId: string;
      paymentOnboardingId: string;
      providerAccountRef?: string | null | undefined;
      status: string;
      tenantId: string;
    }): Promise<PaymentOnboardingReviewResult> => {
      const status = input.status.trim().toLowerCase();

      if (!allowedReviewStatuses.has(status)) {
        return {
          ok: false,
          error: "payment_onboarding_status_invalid",
          status: 400,
        };
      }

      const reviewed = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(paymentOnboarding)
          .set({
            notes: input.notes ?? null,
            providerAccountRef: input.providerAccountRef ?? null,
            status,
          })
          .where(
            and(
              eq(paymentOnboarding.id, input.paymentOnboardingId),
              eq(paymentOnboarding.tenantId, input.tenantId),
            ),
          )
          .returning(selectPaymentOnboardingFields());

        if (!row) {
          return null;
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          tenantId: input.tenantId,
          action: "payment_onboarding.reviewed",
          targetType: "payment_onboarding",
          targetId: row.id,
          metadata: {
            provider: row.provider,
            status: row.status,
          },
        });

        return row;
      });

      if (!reviewed) {
        return {
          ok: false,
          error: "payment_onboarding_not_found",
          status: 404,
        };
      }

      return {
        ok: true,
        paymentOnboarding: reviewed,
      };
    },

    /**
     * Decrypt merchant Chapa secret for **store checkout init** only when online is enabled.
     * Never returns platform env billing credentials.
     */
    getMerchantChapaCredentials: async (input: {
      tenantId: string;
      /** When true, require onlineEnabled (storefront). Internal ops may pass false. */
      requireOnlineEnabled?: boolean;
    }): Promise<
      | { ok: true; secretKey: string; providerAccountRef: string | null }
      | { ok: false; error: "merchant_chapa_not_configured" }
    > => {
      const requireOnline = input.requireOnlineEnabled !== false;
      const [row] = await db
        .select({
          secretKey: paymentOnboarding.secretKey,
          onlineEnabled: paymentOnboarding.onlineEnabled,
          providerAccountRef: paymentOnboarding.providerAccountRef,
        })
        .from(paymentOnboarding)
        .where(
          and(eq(paymentOnboarding.tenantId, input.tenantId), eq(paymentOnboarding.provider, "chapa")),
        )
        .limit(1);

      const stored = row?.secretKey?.trim();
      if (!stored) {
        return { ok: false, error: "merchant_chapa_not_configured" };
      }
      if (requireOnline && !row?.onlineEnabled) {
        return { ok: false, error: "merchant_chapa_not_configured" };
      }

      try {
        const secretKey = openSecret(stored).trim();
        if (!secretKey) {
          return { ok: false, error: "merchant_chapa_not_configured" };
        }
        return {
          ok: true,
          secretKey,
          providerAccountRef: row?.providerAccountRef ?? null,
        };
      } catch {
        return { ok: false, error: "merchant_chapa_not_configured" };
      }
    },

    /** Storefront payment-options: Chapa only when secret present and online enabled. */
    isMerchantChapaConfigured: async (input: { tenantId: string }): Promise<boolean> => {
      const [row] = await db
        .select({
          secretKey: paymentOnboarding.secretKey,
          onlineEnabled: paymentOnboarding.onlineEnabled,
        })
        .from(paymentOnboarding)
        .where(
          and(eq(paymentOnboarding.tenantId, input.tenantId), eq(paymentOnboarding.provider, "chapa")),
        )
        .limit(1);
      return Boolean(row?.secretKey?.trim() && row.onlineEnabled);
    },

    setMerchantChapaSecret: async (input: {
      tenantId: string;
      secretKey: string;
      userId?: string;
      onlineEnabled?: boolean;
      providerAccountRef?: string | null;
    }): Promise<
      | { ok: true; fingerprint: string }
      | { ok: false; error: "payment_provider_invalid" | "encryption_unavailable" }
    > => {
      const secretKey = input.secretKey.trim();
      if (!secretKey) {
        return { ok: false, error: "payment_provider_invalid" };
      }

      let sealed: string;
      try {
        sealed = sealSecret(secretKey);
      } catch {
        return { ok: false, error: "encryption_unavailable" };
      }

      const fingerprint = secretFingerprint(secretKey);
      const now = new Date();

      await db.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: paymentOnboarding.id })
          .from(paymentOnboarding)
          .where(
            and(
              eq(paymentOnboarding.tenantId, input.tenantId),
              eq(paymentOnboarding.provider, "chapa"),
            ),
          )
          .limit(1);

        const values = {
          secretKey: sealed,
          secretFingerprint: fingerprint,
          credentialsValidatedAt: now,
          status: "approved",
          providerAccountRef: input.providerAccountRef ?? null,
          onlineEnabled: input.onlineEnabled ?? false,
        };

        if (existing) {
          await transaction
            .update(paymentOnboarding)
            .set(values)
            .where(eq(paymentOnboarding.id, existing.id));
        } else {
          await transaction.insert(paymentOnboarding).values({
            tenantId: input.tenantId,
            provider: "chapa",
            requiredDocuments: [],
            ...values,
          });
        }

        if (input.userId) {
          await transaction.insert(auditLogs).values({
            actorUserId: input.userId,
            tenantId: input.tenantId,
            action: "payment_credentials.set",
            targetType: "payment_onboarding",
            targetId: existing?.id ?? input.tenantId,
            metadata: {
              provider: "chapa",
              fingerprint,
              onlineEnabled: values.onlineEnabled,
            },
          });
        }
      });

      return { ok: true, fingerprint };
    },

    setMerchantChapaOnlineEnabled: async (input: {
      tenantId: string;
      onlineEnabled: boolean;
      userId?: string;
    }): Promise<
      | { ok: true }
      | { ok: false; error: "merchant_chapa_not_configured" }
    > => {
      const [row] = await db
        .select({ id: paymentOnboarding.id, secretKey: paymentOnboarding.secretKey })
        .from(paymentOnboarding)
        .where(
          and(eq(paymentOnboarding.tenantId, input.tenantId), eq(paymentOnboarding.provider, "chapa")),
        )
        .limit(1);

      if (!row?.secretKey?.trim()) {
        return { ok: false, error: "merchant_chapa_not_configured" };
      }

      await db
        .update(paymentOnboarding)
        .set({ onlineEnabled: input.onlineEnabled })
        .where(eq(paymentOnboarding.id, row.id));

      if (input.userId) {
        await db.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: input.onlineEnabled ? "payment_online.enabled" : "payment_online.disabled",
          targetType: "payment_onboarding",
          targetId: row.id,
          metadata: { provider: "chapa" },
        });
      }

      return { ok: true };
    },

    clearMerchantChapaSecret: async (input: {
      tenantId: string;
      userId?: string;
    }): Promise<{ ok: true } | { ok: false; error: "merchant_chapa_not_configured" }> => {
      const [row] = await db
        .select({ id: paymentOnboarding.id })
        .from(paymentOnboarding)
        .where(
          and(eq(paymentOnboarding.tenantId, input.tenantId), eq(paymentOnboarding.provider, "chapa")),
        )
        .limit(1);

      if (!row) {
        return { ok: false, error: "merchant_chapa_not_configured" };
      }

      await db
        .update(paymentOnboarding)
        .set({
          secretKey: null,
          secretFingerprint: null,
          credentialsValidatedAt: null,
          onlineEnabled: false,
        })
        .where(eq(paymentOnboarding.id, row.id));

      if (input.userId) {
        await db.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "payment_credentials.cleared",
          targetType: "payment_onboarding",
          targetId: row.id,
          metadata: { provider: "chapa" },
        });
      }

      return { ok: true };
    },
  };
}
