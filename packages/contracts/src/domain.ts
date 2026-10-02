import { z } from "zod";

export const customDomainLifecycleStatusSchema = z.enum([
  "pending_verification",
  "pending_dns",
  "pending_certificate",
  "active",
  "misconfigured",
  "failed",
  "removing",
]);
export type CustomDomainLifecycleStatus = z.infer<typeof customDomainLifecycleStatusSchema>;

export const domainCheckReasonSchema = z.enum([
  "ready",
  "ownership_missing",
  "dns_missing",
  "https_pending",
  "removal",
  "unsafe_dns",
  "wrong_shop",
  "dns_lookup_failed",
  "caa_lookup_failed",
  "caa_restricted",
  "https_probe_failed",
]);
export const domainCaaRestrictionSchema = z.enum([
  "issuer_not_allowed",
  "http01_not_allowed",
  "account_restricted",
  "unknown_critical_property",
  "unsupported_parameters",
  "invalid_record",
]);
export const domainDiagnosticsSchema = z.object({
  checkedAt: z.string().datetime(),
  reason: domainCheckReasonSchema,
  detail: domainCaaRestrictionSchema.nullable(),
});
export type DomainDiagnostics = z.infer<typeof domainDiagnosticsSchema>;
export const tenantDomainSetupSchema = z.object({
  enabled: z.boolean(),
  entitled: z.boolean(),
  dnsTarget: z.string().min(1),
  ingressIpv4: z.array(z.string().min(1)).max(8),
});
export type TenantDomainSetup = z.infer<typeof tenantDomainSetupSchema>;

export const domainProbeIdentitySchema = z
  .object({
    version: z.literal(1),
    hostname: z.string().min(1).max(253),
    tenantId: z.string().uuid(),
    domainId: z.string().uuid(),
    nonce: z.string().regex(/^[a-f0-9]{32}$/),
  })
  .strict();
export type DomainProbeIdentity = z.infer<typeof domainProbeIdentitySchema>;

export const tenantDomainSchema = z.object({
  id: z.string().min(1),
  hostname: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1),
  isPrimary: z.boolean(),
  verificationStatus: z.string().min(1),
  sslStatus: z.string().min(1),
  diagnostics: domainDiagnosticsSchema.nullable().optional(),
  warningGraceExpiresAt: z.string().datetime().nullable().optional(),
  verificationChallenge: z
    .object({
      recordName: z.string().min(1),
      recordValue: z.string().min(1),
      expiresAt: z.string().min(1),
    })
    .nullable()
    .optional(),
});
export const tenantDomainListResponseSchema = z.object({
  domains: z.array(tenantDomainSchema),
  redirectToPrimary: z.boolean().default(false),
  setup: tenantDomainSetupSchema.optional(),
});
export const tenantDomainRedirectPolicySchema = z.object({ redirectToPrimary: z.boolean() });
export const tenantDomainResponseSchema = z.object({ domain: tenantDomainSchema });
export const tenantDomainRemovalResponseSchema = z.object({
  status: z.enum(["removed", "removing"]),
});
export type TenantDomainContract = z.infer<typeof tenantDomainSchema>;
