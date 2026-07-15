import type { ChapaPaymentCallbackResult } from "../../types/index.js";

type ChapaPaymentServiceOptions = {
  apiUrl?: string | undefined;
  /**
   * Called after a successful Chapa verification so Medusa payment/order
   * state can be updated (capture / mark paid).
   */
  onVerifiedSuccess?: (input: {
    providerReference: string | null;
    tenantId: string;
    txRef: string;
  }) => Promise<void>;
  recordAnalyticsEvent?: (input: {
    eventType: string;
    idempotencyKey?: string | null | undefined;
    properties?: unknown;
    source: "medusa" | "platform" | "storefront";
    subjectId?: string | null | undefined;
    subjectType?: string | null | undefined;
    tenantId: string;
  }) => Promise<{
    ok: boolean;
  }>;
  recordNotificationEvent?: (input: {
    eventType: "payment.failed" | "payment.paid" | "payment.webhook_failed";
    payload?: unknown;
    tenantId: string;
  }) => Promise<{ ok: true; logCount: number; logIds?: string[] }>;
  secretKey?: string | undefined;
};

type ChapaVerifyResponse = {
  data?: Record<string, unknown> & {
    ref_id?: string;
    reference?: string;
    status?: string;
    tx_ref?: string;
  };
  message?: string;
  status?: string;
};

const defaultApiUrl = "https://api.chapa.co/v1";

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Chapa sometimes returns message as string, array, or nested object. */
export function formatChapaErrorMessage(message: unknown, httpStatus?: number): string {
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  if (Array.isArray(message)) {
    const parts = message
      .map((item) => formatChapaErrorMessage(item))
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  if (message && typeof message === "object") {
    const record = message as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
    const fieldErrors = Object.entries(record)
      .map(([key, value]) => {
        if (typeof value === "string" && value.trim()) return `${key}: ${value.trim()}`;
        if (Array.isArray(value)) {
          const joined = value.map(String).filter(Boolean).join(", ");
          return joined ? `${key}: ${joined}` : null;
        }
        return null;
      })
      .filter((part): part is string => Boolean(part));
    if (fieldErrors.length > 0) return fieldErrors.join("; ");
    try {
      const json = JSON.stringify(message);
      if (json && json !== "{}" && json !== "[]") return json.slice(0, 300);
    } catch {
      // ignore
    }
  }
  if (httpStatus) {
    return `Chapa payment initialization failed (HTTP ${httpStatus}).`;
  }
  return "Chapa payment initialization failed.";
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase();
}

function getEventType(status: string) {
  return status === "success" ? "payment.paid" : "payment.failed";
}

function getAnalyticsPaymentEventType(status: string) {
  return status === "success" ? "payment.captured" : "payment.failed";
}

async function recordPaymentAnalyticsEvent(options: {
  eventType: string;
  properties: Record<string, unknown>;
  recordAnalyticsEvent: ChapaPaymentServiceOptions["recordAnalyticsEvent"];
  tenantId: string;
  txRef: string;
}) {
  try {
    await options.recordAnalyticsEvent?.({
      eventType: options.eventType,
      idempotencyKey: `chapa:${options.txRef}:${options.eventType}`,
      properties: {
        provider: "chapa",
        ...options.properties,
      },
      source: "platform",
      subjectId: options.txRef,
      subjectType: "payment",
      tenantId: options.tenantId,
    });
  } catch {
    // Analytics should not block payment callback handling.
  }
}

export function createChapaPaymentService(options: ChapaPaymentServiceOptions) {
  const apiUrl = (options.apiUrl ?? defaultApiUrl).replace(/\/$/, "");

  async function verifyPayment(txRef: string): Promise<ChapaVerifyResponse | undefined> {
    if (!options.secretKey) {
      throw new Error("CHAPA_SECRET_KEY is required to verify Chapa payments.");
    }

    const response = await fetch(`${apiUrl}/transaction/verify/${encodeURIComponent(txRef)}`, {
      headers: {
        authorization: `Bearer ${options.secretKey}`,
      },
      method: "GET",
    });

    const body = (await response.json().catch(() => undefined)) as ChapaVerifyResponse | undefined;

    if (!response.ok) {
      return undefined;
    }

    return body;
  }

  /**
   * One-shot checkout for platform subscription invoices (not Medusa commerce).
   * Chapa is picky: amount as decimal string, title ≤16 chars; message may be a non-string.
   */
  async function initializePayment(input: {
    amount: string;
    callbackUrl: string;
    currency?: string;
    description?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    returnUrl: string;
    title?: string;
    txRef: string;
  }): Promise<{ checkoutUrl: string; txRef: string }> {
    if (!options.secretKey) {
      throw new Error("CHAPA_SECRET_KEY is required to initialize Chapa payments.");
    }

    const amountNumber = Number(String(input.amount).replace(/,/g, ""));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      throw new Error("Chapa amount must be a positive number.");
    }
    // Chapa expects a decimal string (e.g. "2499.00"), not an integer bare form.
    const amount = amountNumber.toFixed(2);
    // Official limits: title max 16, description max 50.
    const title = (input.title ?? "ECS Billing").slice(0, 16);
    const description = (input.description ?? "Plan payment").slice(0, 50);

    const payload = {
      amount,
      currency: (input.currency ?? "ETB").toUpperCase(),
      email: input.email.trim(),
      first_name: (input.firstName ?? "Merchant").slice(0, 50),
      last_name: (input.lastName ?? "Owner").slice(0, 50),
      tx_ref: input.txRef,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      customization: {
        title,
        description,
      },
    };

    const response = await fetch(`${apiUrl}/transaction/initialize`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => undefined)) as
      | {
          data?: { checkout_url?: string };
          message?: unknown;
          status?: string;
        }
      | undefined;

    const checkoutUrl = body?.data?.checkout_url?.trim();
    if (!response.ok || !checkoutUrl) {
      throw new Error(formatChapaErrorMessage(body?.message, response.status));
    }

    return { checkoutUrl, txRef: input.txRef };
  }

  return {
    verifyPayment,
    initializePayment,

    handleChapaPaymentCallback: async (input: {
      providerReference?: string | null | undefined;
      reportedStatus?: string | null | undefined;
      tenantId?: string | null | undefined;
      txRef?: string | null | undefined;
    }): Promise<ChapaPaymentCallbackResult> => {
      const txRef = getString(input.txRef);
      const tenantId = getString(input.tenantId);

      if (!txRef) {
        return {
          ok: false,
          error: "missing_tx_ref",
          status: 400,
        };
      }

      if (!tenantId) {
        return {
          ok: false,
          error: "missing_tenant_context",
          status: 400,
        };
      }

      let verification: ChapaVerifyResponse | undefined;

      try {
        verification = await verifyPayment(txRef);
      } catch {
        await recordPaymentAnalyticsEvent({
          eventType: "payment.webhook_failed",
          properties: {
            reason: "verification_request_failed",
            reportedStatus: input.reportedStatus,
            txRef,
          },
          recordAnalyticsEvent: options.recordAnalyticsEvent,
          tenantId,
          txRef,
        });

        await options.recordNotificationEvent?.({
          eventType: "payment.webhook_failed",
          payload: {
            reason: "verification_request_failed",
            reportedStatus: input.reportedStatus,
            txRef,
          },
          tenantId,
        });

        return {
          ok: false,
          error: "chapa_verification_failed",
          status: 502,
        };
      }

      if (!verification) {
        await recordPaymentAnalyticsEvent({
          eventType: "payment.webhook_failed",
          properties: {
            reason: "verification_not_found",
            reportedStatus: input.reportedStatus,
            txRef,
          },
          recordAnalyticsEvent: options.recordAnalyticsEvent,
          tenantId,
          txRef,
        });

        await options.recordNotificationEvent?.({
          eventType: "payment.webhook_failed",
          payload: {
            reason: "verification_not_found",
            reportedStatus: input.reportedStatus,
            txRef,
          },
          tenantId,
        });

        return {
          ok: false,
          error: "chapa_payment_not_found",
          status: 404,
        };
      }

      const verifiedStatus =
        normalizeStatus(verification.data?.status) ??
        normalizeStatus(verification.status) ??
        "pending";
      const eventType = getEventType(verifiedStatus);
      const analyticsEventType = getAnalyticsPaymentEventType(verifiedStatus);
      const providerReference =
        getString(input.providerReference) ??
        getString(verification.data?.ref_id) ??
        getString(verification.data?.reference) ??
        null;

      await recordPaymentAnalyticsEvent({
        eventType: analyticsEventType,
        properties: {
          providerReference,
          reportedStatus: input.reportedStatus,
          status: verifiedStatus,
          txRef,
        },
        recordAnalyticsEvent: options.recordAnalyticsEvent,
        tenantId,
        txRef,
      });

      await options.recordNotificationEvent?.({
        eventType,
        payload: {
          providerReference,
          reportedStatus: input.reportedStatus,
          status: verifiedStatus,
          txRef,
        },
        tenantId,
      });

      if (verifiedStatus === "success" && options.onVerifiedSuccess) {
        try {
          await options.onVerifiedSuccess({
            providerReference,
            tenantId,
            txRef,
          });
        } catch {
          // Medusa update failures are logged via analytics; webhook still ok.
          await recordPaymentAnalyticsEvent({
            eventType: "payment.webhook_failed",
            properties: {
              reason: "medusa_capture_failed",
              providerReference,
              txRef,
            },
            recordAnalyticsEvent: options.recordAnalyticsEvent,
            tenantId,
            txRef,
          });
        }
      }

      return {
        ok: true,
        eventType,
        providerReference,
        status: verifiedStatus,
        tenantId,
        txRef,
      };
    },
  };
}
