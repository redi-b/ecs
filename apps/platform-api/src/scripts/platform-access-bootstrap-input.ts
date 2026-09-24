import {
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
} from "../context/platform-authorization.js";

export type PlatformAccessBootstrapInput = {
  confirmedByUserId: string;
  expiresAt: Date | null;
  permissions: PlatformPermission[];
  userId: string;
};

export function parsePlatformAccessBootstrapInput(args: string[]): PlatformAccessBootstrapInput {
  const userId = getArg(args, "--user-id");
  const confirmedByUserId = getArg(args, "--confirmed-by-user-id");
  const rawPermissions = getArg(args, "--permissions");
  if (!userId || !confirmedByUserId || !rawPermissions || !args.includes("--confirm-bootstrap")) {
    throw new Error(
      "Required: --user-id, --confirmed-by-user-id, --permissions, and --confirm-bootstrap",
    );
  }
  if (userId === confirmedByUserId) {
    throw new Error("Bootstrap target and confirming user must be different people");
  }
  const requested = [
    ...new Set(
      rawPermissions
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const allowed = new Set<string>(PLATFORM_PERMISSIONS);
  if (!requested.length || requested.some((permission) => !allowed.has(permission))) {
    throw new Error(`Permissions must be selected from: ${PLATFORM_PERMISSIONS.join(", ")}`);
  }
  const expiresValue = getArg(args, "--expires-at");
  const expiresAt = expiresValue ? new Date(expiresValue) : null;
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
    throw new Error("--expires-at must be a valid future ISO timestamp");
  }
  return { userId, confirmedByUserId, permissions: requested as PlatformPermission[], expiresAt };
}

function getArg(args: string[], name: string) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1]?.trim() : undefined;
  return value || undefined;
}
