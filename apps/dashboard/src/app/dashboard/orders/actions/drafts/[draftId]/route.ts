import type { MerchantSaleDraftContent } from "@ecs/contracts";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  archiveMerchantSaleDraft,
  getMerchantSaleDraft,
  saveMerchantSaleDraft,
} from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await getMerchantSaleDraft({
    cookieHeader: cookieStore.toString(),
    draftId,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  });
  return result.ok
    ? NextResponse.json({ draft: result.draft })
    : NextResponse.json({ error: result.message }, { status: result.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => undefined)) as
      | (MerchantSaleDraftContent & { expectedRevision?: unknown })
      | undefined;
    const expectedRevision = Number(body?.expectedRevision);
    if (!body || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
      return { ok: false, message: "sale_draft_revision_required", status: 400 };
    }
    const result = await saveMerchantSaleDraft({
      content: body,
      cookieHeader: context.cookieHeader,
      draftId,
      expectedRevision,
      idempotencyKey: context.request.headers.get("idempotency-key")?.trim() || crypto.randomUUID(),
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    return result.ok
      ? { ok: true, data: { draft: result.draft } }
      : { ok: false, message: result.message, status: result.status };
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as { revision?: unknown };
    const revision = Number(body.revision);
    if (!Number.isInteger(revision) || revision < 1) {
      return { ok: false, message: "sale_draft_revision_required", status: 400 };
    }
    const result = await archiveMerchantSaleDraft({
      cookieHeader: context.cookieHeader,
      draftId,
      idempotencyKey: context.request.headers.get("idempotency-key")?.trim() || crypto.randomUUID(),
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      revision,
    });
    return result.ok
      ? { ok: true, data: null }
      : { ok: false, message: result.message, status: result.status };
  });
}
