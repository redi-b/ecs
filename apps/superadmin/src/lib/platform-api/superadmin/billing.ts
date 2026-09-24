import { operatorPlanCatalogSchema, platformErrorSchema } from "@ecs/contracts";

import { platformFetch, type PlatformRequestContext } from "@/lib/platform-api/client";

export async function getOperatorPlanCatalog(options: PlatformRequestContext) {
  const response = await platformFetch("/platform/operator/billing/plans", options);
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false as const,
      message: error.success ? error.data.error : "billing_plans_unavailable",
      status: response.status,
    };
  }
  const parsed = operatorPlanCatalogSchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, data: parsed.data }
    : { ok: false as const, message: "invalid_billing_plan_response", status: 502 };
}

export async function forwardPlanCommand(
  options: PlatformRequestContext & {
    body: unknown;
    path: string;
    method: "POST" | "PUT";
  },
) {
  const response = await platformFetch(options.path, {
    body: JSON.stringify(options.body),
    contentType: "json",
    cookieHeader: options.cookieHeader,
    method: options.method,
    platformApiBaseUrl: options.platformApiBaseUrl,
  });
  const data = await response.json().catch(() => ({}));
  return { data, status: response.status };
}
