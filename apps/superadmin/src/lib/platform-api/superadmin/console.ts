import {
  operatorAuditListSchema,
  operatorHealthSchema,
  operatorWorkListSchema,
  platformErrorSchema,
  platformOperatorListSchema,
} from "@ecs/contracts";

import { platformFetch } from "@/lib/platform-api/client";

type Options = {
  action?: string;
  actor?: string;
  category?: "billing" | "merchant" | "provisioning" | "support";
  cookieHeader?: string | null;
  from?: string;
  kind?: "background_job" | "shop_setup";
  limit?: number;
  merchant?: string;
  offset?: number;
  outcome?: "accepted" | "completed" | "failed" | "unknown";
  platformApiBaseUrl?: string;
  resource?: string;
  to?: string;
};

export function getOperatorWork(options: Options) {
  return request(options, "/platform/operator/work", operatorWorkListSchema);
}

export function getOperatorAudit(options: Options) {
  return request(options, "/platform/operator/audit", operatorAuditListSchema);
}

export function getPlatformOperators(options: Options) {
  return request(options, "/platform/operator/operators", platformOperatorListSchema);
}

export function getPlatformHealth(options: Options) {
  return request(options, "/platform/operator/health", operatorHealthSchema);
}

async function request<T>(
  options: Options,
  path: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
) {
  const response = await platformFetch(path, {
    cookieHeader: options.cookieHeader,
    ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    searchParams: {
      action: options.action,
      actor: options.actor,
      category: options.category,
      from: options.from,
      kind: options.kind,
      limit: options.limit,
      merchant: options.merchant,
      offset: options.offset,
      outcome: options.outcome,
      resource: options.resource,
      to: options.to,
    },
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false as const,
      message: error.success ? error.data.error : "operator_console_unavailable",
      status: response.status,
    };
  }
  const parsed = schema.safeParse(data);
  return parsed.success
    ? { ok: true as const, data: parsed.data }
    : { ok: false as const, message: "invalid_operator_console_response", status: 502 };
}
