import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { listAccountSessions, revokeAccountSession } from "@/lib/platform-auth-account";

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export async function GET(request: Request) {
  const ctx = await getAccountAuthRequestContext(request);
  const result = await listAccountSessions(ctx);

  if (!result.ok) {
    return NextResponse.json(
      { error: "sessions_unavailable", sessions: [] },
      { status: result.status },
    );
  }

  const currentToken = getSessionTokenFromCookie(ctx.cookieHeader);
  const sessions = result.sessions
    .slice()
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((session) => ({
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      id: session.id,
      ipAddress: session.ipAddress,
      isCurrent: currentToken
        ? session.token === currentToken || session.token.startsWith(`${currentToken}.`)
        : false,
      token: session.token,
      updatedAt: session.updatedAt,
      userAgent: session.userAgent,
    }));

  // Fallback: if cookie token didn't match any row, mark the most recently active as current.
  if (currentToken && !sessions.some((session) => session.isCurrent) && sessions[0]) {
    sessions[0].isCurrent = true;
  }
  if (!currentToken && sessions[0]) {
    sessions[0].isCurrent = true;
  }

  return NextResponse.json({ ok: true as const, sessions });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const ctx = await getAccountAuthRequestContext(request);
  const currentToken = getSessionTokenFromCookie(ctx.cookieHeader);
  if (
    currentToken &&
    (token === currentToken || token.startsWith(`${currentToken}.`) || currentToken.startsWith(`${token}.`))
  ) {
    return NextResponse.json({ error: "cannot_revoke_current" }, { status: 400 });
  }

  const result = await revokeAccountSession({
    ...ctx,
    token,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.message.toLowerCase().includes("origin")
            ? "auth_origin_rejected"
            : "session_revoke_failed",
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true as const });
}

function getSessionTokenFromCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader?.trim()) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const name of SESSION_COOKIE_NAMES) {
    const match = parts.find((part) => part.startsWith(`${name}=`));
    if (!match) continue;
    const value = decodeURIComponent(match.slice(name.length + 1));
    // Cookie may be signed as "token.signature"
    return value.split(".")[0] || value;
  }
  return null;
}
