import { platformErrorSchema, superadminSupportHistorySchema } from "@ecs/contracts";

import { platformFetch } from "../client";

type Common = { cookieHeader?: string | null; platformApiBaseUrl?: string; tenantId: string };

export async function getSuperadminSupportHistory(options: Common) {
  const response = await request(options, "GET");
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return errorResult(response, data);
  const parsed = superadminSupportHistorySchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, history: parsed.data.history }
    : { ok: false as const, message: "invalid_support_history", status: 502 };
}

export async function createSuperadminSupportNote(options: Common & { body: string }) {
  const response = await request(options, "POST", { body: options.body });
  const data = await response.json().catch(() => undefined);
  return response.ok ? { ok: true as const } : errorResult(response, data);
}

function request(options: Common, method: "GET" | "POST", body?: unknown) {
  return platformFetch(
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/support${method === "POST" ? "/notes" : ""}`,
    {
      ...(body === undefined ? {} : { body: JSON.stringify(body), contentType: "json" as const }),
      cookieHeader: options.cookieHeader,
      method,
      ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    },
  );
}

function errorResult(response: Response, data: unknown) {
  const parsed = platformErrorSchema.safeParse(data);
  return {
    ok: false as const,
    message: parsed.success ? parsed.data.error : "support_request_failed",
    status: response.status,
  };
}
