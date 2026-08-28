import { headers } from "next/headers";

import {
  createSuperadminSupportNote,
  getSuperadminSupportHistory,
} from "@/lib/platform-api/superadmin/support";

function common(cookieHeader: string | null, tenantId: string) {
  return {
    cookieHeader,
    tenantId,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const requestHeaders = await headers();
  const result = await getSuperadminSupportHistory(common(requestHeaders.get("cookie"), tenantId));
  return Response.json(result.ok ? { history: result.history } : { error: result.message }, {
    status: result.ok ? 200 : result.status,
  });
}

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { body?: unknown };
  if (
    typeof body.body !== "string" ||
    body.body.trim().length < 3 ||
    body.body.trim().length > 4_000
  ) {
    return Response.json({ error: "support_note_invalid" }, { status: 400 });
  }
  const requestHeaders = await headers();
  const result = await createSuperadminSupportNote({
    ...common(requestHeaders.get("cookie"), tenantId),
    body: body.body.trim(),
  });
  return Response.json(result.ok ? { ok: true } : { error: result.message }, {
    status: result.ok ? 201 : result.status,
  });
}
