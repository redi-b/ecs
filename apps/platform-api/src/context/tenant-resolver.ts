import {
  type CustomDomainLifecycleStatus,
  type ShopDetails,
  shopDetailsSchema,
} from "@ecs/contracts";
import { DOMAIN_WARNING_GRACE_MS } from "../modules/domains/lifecycle.js";

export type TenantStatus = "draft" | "active" | "suspended" | "cancelled";

export type DomainStatus = CustomDomainLifecycleStatus | "disabled";

export type DomainVerificationStatus = "pending" | "verified" | "failed";

export type TenantDomainRecord = {
  shopDetails?: unknown;
  domainId: string;
  hostname: string;
  domainStatus: DomainStatus | string;
  verificationStatus: DomainVerificationStatus | string;
  domainType?: string;
  sslStatus?: string;
  activatedAt?: Date | null;
  warningSince?: Date | null;
  warningReason?: string | null;
  primaryHostname?: string | null;
  primaryDomainStatus?: DomainStatus | string | null;
  primaryDomainVerificationStatus?: DomainVerificationStatus | string | null;
  primaryDomainType?: string | null;
  primaryDomainSslStatus?: string | null;
  primaryDomainActivatedAt?: Date | null;
  primaryDomainWarningSince?: Date | null;
  primaryDomainWarningReason?: string | null;
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
  shopDetails?: ShopDetails | null;
  tenantId: string;
  tenantName: string;
  tenantHandle: string;
  hostname: string;
  primaryHostname: string;
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

function isDomainAdmitted(
  record: {
    type: string | null | undefined;
    status: string | null | undefined;
    verification: string | null | undefined;
    ssl: string | null | undefined;
    activatedAt: Date | null | undefined;
    warningSince: Date | null | undefined;
    warningReason: string | null | undefined;
  },
  now: number,
) {
  if (record.verification !== "verified") return false;
  if (record.type !== "custom_domain") return record.status === "active";
  const activatedAt = record.activatedAt?.getTime();
  if (
    record.ssl !== "active" ||
    activatedAt === undefined ||
    !Number.isFinite(activatedAt) ||
    activatedAt < 0 ||
    activatedAt > now
  )
    return false;
  if (record.status === "active") return true;
  const warningSince = record.warningSince?.getTime();
  return (
    record.status === "misconfigured" &&
    (record.warningReason === "dns_missing" || record.warningReason === "ownership_missing") &&
    warningSince !== undefined &&
    Number.isFinite(warningSince) &&
    warningSince >= activatedAt &&
    warningSince <= now &&
    now - warningSince < DOMAIN_WARNING_GRACE_MS
  );
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

  const now = Date.now();
  if (
    !isDomainAdmitted(
      {
        type: record.domainType,
        status: record.domainStatus,
        verification: record.verificationStatus,
        ssl: record.sslStatus,
        activatedAt: record.activatedAt,
        warningSince: record.warningSince,
        warningReason: record.warningReason,
      },
      now,
    )
  ) {
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
      ...(shopDetailsSchema.safeParse(record.shopDetails).success
        ? { shopDetails: shopDetailsSchema.parse(record.shopDetails) }
        : {}),
      tenantHandle: record.tenantHandle,
      hostname,
      primaryHostname:
        record.primaryHostname &&
        isDomainAdmitted(
          {
            type: record.primaryDomainType,
            status: record.primaryDomainStatus,
            verification: record.primaryDomainVerificationStatus,
            ssl: record.primaryDomainSslStatus,
            activatedAt: record.primaryDomainActivatedAt,
            warningSince: record.primaryDomainWarningSince,
            warningReason: record.primaryDomainWarningReason,
          },
          now,
        )
          ? normalizeHostname(record.primaryHostname)
          : hostname,
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
