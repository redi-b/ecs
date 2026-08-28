import { withMerchantAction } from "@/lib/platform-api";
import {
  createMerchantDomain,
  getMerchantDomains,
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
      ? { ok: true, data: { domains: result.domains }, status: 200 }
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
    };
    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      tenantId: context.tenantId,
    };
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
