"use client";

import type { MerchantDashboardAccess, MerchantPermission } from "@ecs/contracts";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { type AccessRequirement, allows } from "@/lib/access-policy";

type AccessContextValue = {
  permissions: ReadonlySet<string>;
  can: (permission: MerchantPermission) => boolean;
  allows: (requirement: AccessRequirement) => boolean;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({
  access,
  children,
  refreshOnFocus = true,
}: {
  access: Pick<MerchantDashboardAccess, "permissions">;
  children: ReactNode;
  refreshOnFocus?: boolean;
}) {
  const router = useRouter();
  const lastCheckedAt = useRef(0);
  const permissionFingerprint = [...(access.permissions ?? [])].sort().join("\n");
  const value = useMemo<AccessContextValue>(() => {
    const permissions = new Set(access.permissions ?? []);
    return {
      permissions,
      can: (permission) => permissions.has(permission),
      allows: (requirement) => allows(permissions, requirement),
    };
  }, [access.permissions]);

  const refreshAccess = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && now - lastCheckedAt.current < 5_000) return;
      lastCheckedAt.current = now;

      const response = await fetch("/dashboard/access-state", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      }).catch(() => null);

      if (!response) return;
      if (response.status === 401 || response.status === 403) {
        router.refresh();
        return;
      }
      if (!response.ok) return;

      const body = (await response.json().catch(() => null)) as { permissions?: unknown } | null;
      if (
        !Array.isArray(body?.permissions) ||
        !body.permissions.every((item) => typeof item === "string")
      ) {
        return;
      }

      if ([...body.permissions].sort().join("\n") !== permissionFingerprint) {
        router.refresh();
      }
    },
    [permissionFingerprint, router],
  );

  useEffect(() => {
    if (!refreshOnFocus) return;

    const onFocus = () => void refreshAccess();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshAccess();
    };
    const timer = window.setInterval(() => void refreshAccess(true), 60_000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshAccess, refreshOnFocus]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const access = useContext(AccessContext);
  if (!access) throw new Error("useAccess must be used within AccessProvider");
  return access;
}

export function usePermission(permission: MerchantPermission) {
  return useAccess().can(permission);
}

export function PermissionGate({
  children,
  permission,
  fallback = null,
}: {
  children: ReactNode;
  permission: MerchantPermission;
  fallback?: ReactNode;
}) {
  const { can } = useAccess();
  return can(permission) ? children : fallback;
}

export function PolicyGate({
  children,
  fallback = null,
  requirement,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  requirement: AccessRequirement;
}) {
  const access = useAccess();
  return access.allows(requirement) ? children : fallback;
}

export function usePolicy(requirement: AccessRequirement) {
  return useAccess().allows(requirement);
}
