import { withMerchantAction } from "@/lib/platform-api";
import {
  createMerchantDomain,
  getMerchantDomains,
  removeMerchantDomain,
  setMerchantDomainRedirectPolicy,
  setMerchantPrimaryDomain,
  verifyMerchantDomain,
} from "@/lib/platform-api/domains";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (!context.tenantId) {
      return { ok: false, message: "tenant_required", status: 400 };
    }
    const result = await getMerchantDomains({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      tenantId: context.tenantId,
    });
    return result.ok
      ? {
          ok: true,
          data: {
            domains: result.domains,
            redirectToPrimary: result.redirectToPrimary,
            ...(result.setup ? { setup: result.setup } : {}),
          },
          status: 200,
        }
      : { ok: false, message: result.message, status: result.status };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (!context.tenantId) {
      return { ok: false, message: "tenant_required", status: 400 };
    }
    const body = (await context.request.json().catch(() => ({}))) as {
      action?: unknown;
      domainId?: unknown;
      hostname?: unknown;
      redirectToPrimary?: unknown;
    };
    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      tenantId: context.tenantId,
    };
    if (body.action === "remove" && typeof body.domainId === "string") {
      const removal = await removeMerchantDomain({ ...common, domainId: body.domainId });
      return removal.ok
        ? {
            ok: true,
            data: { status: removal.status },
            status: removal.status === "removing" ? 202 : 200,
          }
        : { ok: false, message: removal.message, status: removal.status };
    }
    if (body.action === "redirect-policy" && typeof body.redirectToPrimary === "boolean") {
      const policy = await setMerchantDomainRedirectPolicy({
        ...common,
        redirectToPrimary: body.redirectToPrimary,
      });
      return policy.ok
        ? { ok: true, data: { redirectToPrimary: policy.redirectToPrimary }, status: 200 }
        : { ok: false, message: policy.message, status: policy.status };
    }
    const result =
      body.action === "create" && typeof body.hostname === "string"
        ? await createMerchantDomain({ ...common, hostname: body.hostname })
        : body.action === "verify" && typeof body.domainId === "string"
          ? await verifyMerchantDomain({ ...common, domainId: body.domainId })
          : body.action === "primary" && typeof body.domainId === "string"
            ? await setMerchantPrimaryDomain({ ...common, domainId: body.domainId })
            : { ok: false as const, message: "domain_action_invalid", status: 400 };
    return result.ok
      ? { ok: true, data: { domain: result.domain }, status: body.action === "create" ? 201 : 200 }
      : { ok: false, message: result.message, status: result.status };
  });
}
