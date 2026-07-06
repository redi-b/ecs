import { normalizeHostname } from "../tenancy/tenant-resolver.js";

export type HostConfigEnv = {
  PLATFORM_PUBLIC_BASE_URL?: string;
  DASHBOARD_PUBLIC_BASE_URL?: string;
};

export function getSystemHosts(env: HostConfigEnv): string[] {
  return [env.PLATFORM_PUBLIC_BASE_URL, env.DASHBOARD_PUBLIC_BASE_URL].flatMap((value) => {
    if (!value) {
      return [];
    }

    try {
      return [normalizeHostname(new URL(value).host)];
    } catch {
      return [];
    }
  });
}
