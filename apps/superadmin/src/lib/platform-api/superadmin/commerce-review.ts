import { platformErrorSchema, superadminCommerceReviewSchema } from "@ecs/contracts";

import { platformFetch } from "@/lib/platform-api/client";

type Common = { cookieHeader?: string | null; platformApiBaseUrl?: string; tenantId: string };

export async function getSuperadminCommerceReview(options: Common) {
  const response = await platformFetch(
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/commerce-review`,
    {
      cookieHeader: options.cookieHeader,
      ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    },
  );
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return failure(response.status, data);
  const parsed = superadminCommerceReviewSchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, review: parsed.data }
    : { ok: false as const, message: "invalid_commerce_review_response", status: 502 };
}

export async function updateSuperadminInvoice(
  options: Common & {
    invoiceId: string;
    provider?: string;
    providerReference?: string;
    reason: string;
    status: "paid" | "void";
  },
) {
  return mutate(
    options,
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/billing/invoices/${encodeURIComponent(options.invoiceId)}/status`,
    {
      provider: options.provider,
      providerReference: options.providerReference,
      reason: options.reason,
      status: options.status,
    },
  );
}

export async function reviewSuperadminPayment(
  options: Common & {
    paymentOnboardingId: string;
    providerAccountRef?: string;
    reason: string;
    status: "approved" | "needs_review" | "rejected";
  },
) {
  return mutate(
    options,
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/payments/onboarding/${encodeURIComponent(options.paymentOnboardingId)}/review`,
    {
      providerAccountRef: options.providerAccountRef,
      reason: options.reason,
      status: options.status,
    },
  );
}

async function mutate(options: Common, path: string, body: Record<string, string | undefined>) {
  const response = await platformFetch(path, {
    body: JSON.stringify(body),
    cookieHeader: options.cookieHeader,
    contentType: "json",
    method: "POST",
    ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
  });
  const data = await response.json().catch(() => undefined);
  return response.ok ? { ok: true as const } : failure(response.status, data);
}

function failure(status: number, data: unknown) {
  const error = platformErrorSchema.safeParse(data);
  return {
    ok: false as const,
    message: error.success ? error.data.error : "commerce_review_unavailable",
    status,
  };
}
