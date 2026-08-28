export function getOpsPublicHost() {
  return getHostname(process.env.SUPERADMIN_PUBLIC_BASE_URL ?? "http://ops.lvh.me");
}

export function isOpsHost(value: string | null | undefined, nodeEnv = process.env.NODE_ENV) {
  const host = normalizeHost(value);
  if (!host) return false;
  if (host === getOpsPublicHost()) return true;
  return nodeEnv === "development" && isLoopbackHost(host);
}

export function normalizeHost(value: string | null | undefined) {
  const host = value?.trim().toLowerCase() ?? "";
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket === -1 ? host : host.slice(1, closingBracket);
  }
  return host.split(":", 1)[0] ?? "";
}

function isLoopbackHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "ops.lvh.me";
  }
}
