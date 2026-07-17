import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { getAuthSessionCookieNamesForDashboard } from "@/lib/auth-cookies";
import {
  listAccountSessions,
  revokeAccountSession,
  revokeOtherAccountSessions,
} from "@/lib/platform-auth-account";

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
    .map((session) => {
      const isCurrent = currentToken
        ? session.token === currentToken || session.token.startsWith(`${currentToken}.`)
        : false;
      return {
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        id: session.id,
        // Prefer stored values; for the active browser session fill gaps from this request
        // (older sessions were often created via server-side sign-in without client IP/UA).
        ipAddress:
          session.ipAddress ||
          (isCurrent && ctx.clientIp ? ctx.clientIp : null),
        isCurrent,
        token: session.token,
        updatedAt: session.updatedAt,
        userAgent:
          session.userAgent ||
          (isCurrent && ctx.userAgent ? ctx.userAgent : null),
      };
    });

  // Fallback: if cookie token didn't match any row, mark the most recently active as current.
  if (currentToken && !sessions.some((session) => session.isCurrent) && sessions[0]) {
    sessions[0].isCurrent = true;
    if (!sessions[0].ipAddress && ctx.clientIp) sessions[0].ipAddress = ctx.clientIp;
    if (!sessions[0].userAgent && ctx.userAgent) sessions[0].userAgent = ctx.userAgent;
  }
  if (!currentToken && sessions[0]) {
    sessions[0].isCurrent = true;
  }

  return NextResponse.json({ ok: true as const, sessions });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    revokeOthers?: unknown;
    token?: unknown;
  } | null;

  const ctx = await getAccountAuthRequestContext(request);

  if (body?.revokeOthers === true) {
    // Resolve other session tokens for a reliable fallback if bulk revoke fails.
    const listed = await listAccountSessions(ctx);
    const currentToken = getSessionTokenFromCookie(ctx.cookieHeader);
    const otherTokens = listed.ok
      ? listed.sessions
          .filter((session) => {
            if (!currentToken) return true;
            return !(
              session.token === currentToken ||
              session.token.startsWith(`${currentToken}.`) ||
              currentToken.startsWith(`${session.token}.`)
            );
          })
          .map((session) => session.token)
      : [];

    const result = await revokeOtherAccountSessions({
      ...ctx,
      otherTokens,
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
    return NextResponse.json({ ok: true as const, revokedOthers: true as const });
  }

  const token = typeof body?.token === "string" ? body.token : "";

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

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
  // Prefer current brand prefix; also accept legacy better-auth.* during rollouts.
  const names = [
    ...getAuthSessionCookieNamesForDashboard(),
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
  ];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const match = parts.find((part) => part.startsWith(`${name}=`));
    if (!match) continue;
    const value = decodeURIComponent(match.slice(name.length + 1));
    // Cookie may be signed as "token.signature"
    return value.split(".")[0] || value;
  }
  return null;
}
