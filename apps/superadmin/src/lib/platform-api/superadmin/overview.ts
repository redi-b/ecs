import { platformErrorSchema, superadminOverviewSchema } from "@ecs/contracts";

import { platformFetch } from "@/lib/platform-api/client";

export async function getSuperadminOverview(options: {
  cookieHeader?: string | null;
  platformApiBaseUrl?: string;
}) {
  const response = await platformFetch("/platform/operator/overview", {
    cookieHeader: options.cookieHeader,
    ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false as const,
      message: error.success ? error.data.error : "operator_overview_unavailable",
      status: response.status,
    };
  }
  const parsed = superadminOverviewSchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, data: parsed.data }
    : { ok: false as const, message: "invalid_operator_overview", status: 502 };
}
