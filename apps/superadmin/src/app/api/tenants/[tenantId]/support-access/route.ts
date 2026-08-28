import { headers } from "next/headers";

import {
  createSuperadminSupportAccess,
  revokeSuperadminSupportAccess,
} from "@/lib/platform-api/superadmin/support-access";

function common(cookieHeader: string | null, tenantId: string) {
  return {
    cookieHeader,
    tenantId,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  };
}

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    expiresAt?: unknown;
    reason?: unknown;
  };
  if (typeof body.expiresAt !== "string" || typeof body.reason !== "string") {
    return Response.json({ error: "support_access_invalid" }, { status: 400 });
  }
  const requestHeaders = await headers();
  const result = await createSuperadminSupportAccess({
    ...common(requestHeaders.get("cookie"), tenantId),
    expiresAt: body.expiresAt,
    reason: body.reason,
  });
  return Response.json(result.ok ? { ok: true } : { error: result.message }, {
    status: result.ok ? 201 : result.status,
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    grantId?: unknown;
    reason?: unknown;
  };
  if (typeof body.grantId !== "string" || typeof body.reason !== "string") {
    return Response.json({ error: "support_access_invalid" }, { status: 400 });
  }
  const requestHeaders = await headers();
  const result = await revokeSuperadminSupportAccess({
    ...common(requestHeaders.get("cookie"), tenantId),
    grantId: body.grantId,
    reason: body.reason,
  });
  return Response.json(result.ok ? { ok: true } : { error: result.message }, {
    status: result.ok ? 200 : result.status,
  });
}
