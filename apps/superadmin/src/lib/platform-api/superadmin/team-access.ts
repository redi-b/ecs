import { platformErrorSchema, superadminMerchantTeamSchema } from "@ecs/contracts";

import { platformFetch } from "../client";

export async function getSuperadminMerchantTeam(options: {
  cookieHeader?: string | null;
  platformApiBaseUrl?: string;
  tenantId: string;
}) {
  const response = await platformFetch(
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/team-access`,
    {
      cookieHeader: options.cookieHeader,
      method: "GET",
      ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    },
  );
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = platformErrorSchema.safeParse(data);
    return {
      ok: false as const,
      message: parsed.success ? parsed.data.error : "team_access_request_failed",
      status: response.status,
    };
  }
  const parsed = superadminMerchantTeamSchema.safeParse(
    data && typeof data === "object" && "team" in data ? data.team : undefined,
  );
  return parsed.success
    ? { ok: true as const, team: parsed.data }
    : { ok: false as const, message: "invalid_team_access", status: 502 };
}
