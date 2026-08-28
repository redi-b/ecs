import {
  platformErrorSchema,
  type TenantDomainContract,
  tenantDomainListResponseSchema,
  tenantDomainResponseSchema,
} from "@ecs/contracts";

import { platformFetch } from "./client";

export type MerchantDomainsResult =
  | { ok: true; domains: TenantDomainContract[] }
  | { ok: false; message: string; status: number };
export type MerchantDomainResult =
  | { ok: true; domain: TenantDomainContract }
  | { ok: false; message: string; status: number };

type CommonOptions = {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
};

export async function getMerchantDomains(options: CommonOptions): Promise<MerchantDomainsResult> {
  const response = await domainFetch(options, "", "GET");
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return domainError(response, data);
  const parsed = tenantDomainListResponseSchema.safeParse(data);
  return parsed.success
    ? { ok: true, domains: parsed.data.domains }
    : { ok: false, message: "invalid_domains_response", status: 502 };
}

export async function createMerchantDomain(
  options: CommonOptions & { hostname: string },
): Promise<MerchantDomainResult> {
  return domainMutation(options, "", "POST", { hostname: options.hostname });
}

export async function verifyMerchantDomain(
  options: CommonOptions & { domainId: string },
): Promise<MerchantDomainResult> {
  return domainMutation(options, `/${encodeURIComponent(options.domainId)}/verify`, "POST");
}

export async function setMerchantPrimaryDomain(
  options: CommonOptions & { domainId: string },
): Promise<MerchantDomainResult> {
  return domainMutation(options, `/${encodeURIComponent(options.domainId)}/primary`, "POST");
}

async function domainMutation(
  options: CommonOptions,
  suffix: string,
  method: "POST",
  body?: unknown,
): Promise<MerchantDomainResult> {
  const response = await domainFetch(options, suffix, method, body);
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return domainError(response, data);
  const parsed = tenantDomainResponseSchema.safeParse(data);
  return parsed.success
    ? { ok: true, domain: parsed.data.domain }
    : { ok: false, message: "invalid_domain_response", status: 502 };
}

function domainFetch(
  options: CommonOptions,
  suffix: string,
  method: "GET" | "POST",
  body?: unknown,
) {
  return platformFetch(
    `/platform/tenants/${encodeURIComponent(options.tenantId)}/domains${suffix}`,
    {
      ...(body === undefined ? {} : { body: JSON.stringify(body), contentType: "json" as const }),
      cookieHeader: options.cookieHeader,
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
      method,
      platformApiBaseUrl: options.platformApiBaseUrl,
    },
  );
}

function domainError(response: Response, data: unknown) {
  const parsed = platformErrorSchema.safeParse(data);
  return {
    ok: false as const,
    message: parsed.success ? parsed.data.error : "domain_request_failed",
    status: response.status,
  };
}
