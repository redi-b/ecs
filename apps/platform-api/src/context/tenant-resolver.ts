export type TenantStatus = "draft" | "active" | "suspended" | "cancelled";

export type DomainStatus = "active" | "pending_verification" | "misconfigured" | "disabled";

export type DomainVerificationStatus = "pending" | "verified" | "failed";

export type TenantDomainRecord = {
  domainId: string;
  hostname: string;
  domainStatus: DomainStatus | string;
  verificationStatus: DomainVerificationStatus | string;
  tenantId: string;
  tenantName: string;
  tenantHandle: string;
  tenantStatus: TenantStatus;
  medusaStoreId: string | null;
  medusaSalesChannelId: string | null;
  medusaStockLocationId: string | null;
  medusaPublishableKeyId: string | null;
  medusaRegionId: string | null;
  medusaShippingProfileId: string | null;
  medusaShippingOptionId: string | null;
  publishedRevisionId: string | null;
  templateId: string | null;
  templateKey: string | null;
  templateVersion: number | null;
};

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  tenantHandle: string;
  hostname: string;
  domainId: string;
  status: TenantStatus;
  medusaStoreId: string | null;
  medusaSalesChannelId: string | null;
  medusaStockLocationId: string | null;
  medusaPublishableKeyId: string | null;
  medusaRegionId: string | null;
  medusaShippingProfileId: string | null;
  medusaShippingOptionId: string | null;
  publishedRevisionId: string | null;
  templateId: string | null;
  templateKey: string | null;
  templateVersion: number | null;
};

export type TenantResolutionError =
  | "shop_context_required"
  | "shop_not_found"
  | "shop_unpublished"
  | "shop_suspended"
  | "domain_misconfigured";

export type TenantResolutionResult =
  | {
      ok: true;
      context: TenantContext;
    }
  | {
      ok: false;
      error: TenantResolutionError;
    };

export type ResolveTenantFromHostOptions = {
  host?: string | undefined;
  platformBaseDomain: string;
  systemHosts: string[];
  findDomainByHostname: (hostname: string) => Promise<TenantDomainRecord | undefined>;
};

export function normalizeHostname(host: string): string {
  return host.trim().replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
}

export async function resolveTenantFromHost(
  options: ResolveTenantFromHostOptions,
): Promise<TenantResolutionResult> {
  if (!options.host?.trim()) {
    return { ok: false, error: "shop_context_required" };
  }

  const hostname = normalizeHostname(options.host);
  const systemHosts = new Set(options.systemHosts.map(normalizeHostname));

  if (systemHosts.has(hostname)) {
    return { ok: false, error: "shop_context_required" };
  }

  const record = await options.findDomainByHostname(hostname);

  if (!record) {
    return { ok: false, error: "shop_not_found" };
  }

  if (record.domainStatus !== "active" || record.verificationStatus !== "verified") {
    return { ok: false, error: "domain_misconfigured" };
  }

  if (record.tenantStatus === "suspended" || record.tenantStatus === "cancelled") {
    return { ok: false, error: "shop_suspended" };
  }

  if (record.tenantStatus !== "active" && record.tenantStatus !== "draft") {
    return { ok: false, error: "shop_unpublished" };
  }

  return {
    ok: true,
    context: {
      tenantId: record.tenantId,
      tenantName: record.tenantName,
      tenantHandle: record.tenantHandle,
      hostname,
      domainId: record.domainId,
      status: record.tenantStatus,
      medusaStoreId: record.medusaStoreId,
      medusaSalesChannelId: record.medusaSalesChannelId,
      medusaStockLocationId: record.medusaStockLocationId,
      medusaPublishableKeyId: record.medusaPublishableKeyId,
      medusaRegionId: record.medusaRegionId,
      medusaShippingProfileId: record.medusaShippingProfileId,
      medusaShippingOptionId: record.medusaShippingOptionId,
      publishedRevisionId: record.publishedRevisionId,
      templateId: record.templateId,
      templateKey: record.templateKey,
      templateVersion: record.templateVersion,
    },
  };
}
