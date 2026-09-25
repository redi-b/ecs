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
  const body = (await request.json().catch(() => null)) as { providerId?: unknown } | null;
  if (typeof body?.providerId !== "string" || !body.providerId)
    return NextResponse.json({ error: "invalid_provider" }, { status: 400 });
  const result = await unlinkAccountConnection({
    ...(await getAccountAuthRequestContext(request)),
    providerId: body.providerId,
  });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
