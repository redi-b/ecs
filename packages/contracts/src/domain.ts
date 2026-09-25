import { z } from "zod";

export const tenantDomainSchema = z.object({
  id: z.string().min(1),
  hostname: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1),
  isPrimary: z.boolean(),
  verificationStatus: z.string().min(1),
  sslStatus: z.string().min(1),
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
});
export const tenantDomainResponseSchema = z.object({ domain: tenantDomainSchema });
export type TenantDomainContract = z.infer<typeof tenantDomainSchema>;
