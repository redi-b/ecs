import type { PlatformPermission } from "../../context/platform-authorization.js";
import type { PlatformAppOptions } from "../../types/platform-app.js";

const RECENT_AUTHENTICATION_MS = 10 * 60 * 1_000;

function requiresRecentAuthentication(permission: PlatformPermission) {
  return (
    permission === "billing.entitlements.update" ||
    permission === "platform.work.retry" ||
    permission === "payments.onboarding.review" ||
    permission === "billing.invoices.update" ||
    permission === "tenants.status.update" ||
    permission === "tenants.support.access.manage"
  );
}

export function isRecentPlatformAuthentication(value: Date | string | undefined, now = Date.now()) {
  if (!value) return false;
  const createdAt = value instanceof Date ? value.getTime() : Date.parse(value);
  return (
    Number.isFinite(createdAt) && createdAt <= now && now - createdAt <= RECENT_AUTHENTICATION_MS
  );
}

type PlatformAccessOptions = Pick<PlatformAppOptions, "authorizePlatformPermission" | "getSession">;

export async function getPlatformAccess(
  options: PlatformAccessOptions,
  headers: Headers,
  permission: PlatformPermission,
) {
  const session = await options.getSession?.(headers);
  if (!session) {
    return { ok: false as const, error: "auth_required" as const, status: 401 as const };
  }
  const authorization = await options.authorizePlatformPermission?.({
    permission,
    userId: session.user.id,
  });
  if (!authorization?.ok) {
    return { ok: false as const, error: "operator_forbidden" as const, status: 403 as const };
  }
  if (
    requiresRecentAuthentication(permission) &&
    !isRecentPlatformAuthentication(session.session?.createdAt)
  ) {
    return {
      ok: false as const,
      error: "reauthentication_required" as const,
      status: 403 as const,
    };
  }
  return { ok: true as const, authorization, session };
}
