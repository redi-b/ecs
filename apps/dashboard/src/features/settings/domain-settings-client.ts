import {
  platformErrorSchema,
  tenantDomainListResponseSchema,
  tenantDomainRemovalResponseSchema,
  tenantDomainResponseSchema,
} from "@ecs/contracts";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";

export type DomainSettingsAction =
  | { action: "create"; hostname: string }
  | { action: "verify" | "primary" | "remove"; domainId: string };

export class DomainSettingsError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

type RequestOptions = { tenantId: string; fetcher?: typeof fetch; signal?: AbortSignal };
async function request(options: RequestOptions, action?: DomainSettingsAction) {
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(
      getTenantScopedPath("/dashboard/settings/domains", options.tenantId),
      {
        cache: "no-store",
        credentials: "same-origin",
        method: action ? "POST" : "GET",
        headers: {
          accept: "application/json",
          ...(action ? { "content-type": "application/json" } : {}),
        },
        ...(options.signal ? { signal: options.signal } : {}),
        ...(action ? { body: JSON.stringify(action) } : {}),
      },
    );
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new DomainSettingsError("domain_request_failed", 0);
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = platformErrorSchema.safeParse(body);
    throw new DomainSettingsError(
      parsed.success ? parsed.data.error : "domain_request_failed",
      response.status,
    );
  }
  return body;
}

export async function getDomainSettings(options: RequestOptions) {
  const parsed = tenantDomainListResponseSchema.safeParse(await request(options));
  if (!parsed.success) throw new DomainSettingsError("domain_response_invalid", 502);
  return parsed.data;
}

export async function mutateDomainSettings(
  options: RequestOptions & { action: DomainSettingsAction },
) {
  const body = await request(options, options.action);
  if (options.action.action === "remove") {
    const parsed = tenantDomainRemovalResponseSchema.safeParse(body);
    if (!parsed.success) throw new DomainSettingsError("domain_response_invalid", 502);
    return { kind: "removal" as const, status: parsed.data.status };
  }
  const parsed = tenantDomainResponseSchema.safeParse(body);
  if (!parsed.success) throw new DomainSettingsError("domain_response_invalid", 502);
  return { kind: "domain" as const, domain: parsed.data.domain };
}
