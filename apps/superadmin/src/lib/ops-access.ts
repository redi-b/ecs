import { headers } from "next/headers";
import { cache } from "react";

import { isOpsHost } from "@/lib/ops-host";
import { platformFetch } from "@/lib/platform-api/client";

export const getOpsAccess = cache(async function getOpsAccess() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!isOpsHost(host)) return { ok: false as const, kind: "wrong_host" as const };

  const response = await platformFetch("/platform/operator/session", {
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => null);
  if (!response?.ok) {
    return {
      ok: false as const,
      kind:
        response?.status === 401
          ? ("unauthenticated" as const)
          : response?.status === 403
            ? ("forbidden" as const)
            : ("unavailable" as const),
    };
  }

  const body = (await response.json().catch(() => null)) as {
    operator?: { email?: unknown; id?: unknown; name?: unknown };
    permissions?: unknown;
  } | null;
  const email = typeof body?.operator?.email === "string" ? body.operator.email : "";
  const id = typeof body?.operator?.id === "string" ? body.operator.id : "";
  const name = typeof body?.operator?.name === "string" ? body.operator.name.trim() : "";
  const permissions = Array.isArray(body?.permissions)
    ? body.permissions.filter((value): value is string => typeof value === "string")
    : null;
  if (!email || !id || !permissions) return { ok: false as const, kind: "unavailable" as const };

  return {
    ok: true as const,
    operator: { email, id, name: name || email.split("@")[0] || "ECS operator" },
    permissions,
  };
});
