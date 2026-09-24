import { NextResponse } from "next/server";
import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { listAccountConnections, unlinkAccountConnection } from "@/lib/platform-auth-account";

export async function GET(request: Request) {
  const result = await listAccountConnections(await getAccountAuthRequestContext(request));
  if (!result.ok)
    return NextResponse.json({ error: "connections_unavailable" }, { status: result.status });
  return NextResponse.json({ connections: result.connections });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { accountId?: unknown } | null;
  if (typeof body?.accountId !== "string" || !body.accountId)
    return NextResponse.json({ error: "invalid_account" }, { status: 400 });
  const result = await unlinkAccountConnection({
    ...(await getAccountAuthRequestContext(request)),
    accountId: body.accountId,
  });
  if (!result.ok) return NextResponse.json({ error: "unlink_failed" }, { status: result.status });
  return NextResponse.json({ ok: true });
}
