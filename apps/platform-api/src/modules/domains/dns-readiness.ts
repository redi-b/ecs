import { Resolver } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { hasDomainOwnershipRecord, isValidCustomDomainHostname } from "./service.js";

type DnsResolver = {
  resolve4: (hostname: string) => Promise<string[]>;
  resolve6: (hostname: string) => Promise<string[]>;
  resolveTxt: (hostname: string) => Promise<string[][]>;
  cancel: () => void;
};

export function createDomainTxtResolver(
  options: {
    createResolver?: () => Pick<DnsResolver, "resolveTxt" | "cancel">;
    timeoutMs?: number;
  } = {},
) {
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000)
    throw new Error("Invalid domain TXT deadline.");
  return async (recordName: string): Promise<string[][]> => {
    const prefix = "_ecs-verification.";
    if (
      !recordName.startsWith(prefix) ||
      !isValidCustomDomainHostname(recordName.slice(prefix.length))
    )
      throw new Error("Invalid ownership TXT record name.");
    const resolver = options.createResolver?.() ?? new Resolver({ timeout: 2000, tries: 1 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        resolver.resolveTxt(recordName),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Domain TXT deadline exceeded.")), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      resolver.cancel();
    }
  };
}

// Conservative special-purpose exclusions (IANA registries). The actual probe
// allowlist is narrower: only operator-configured ingress literals, never DNS.
const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");

export function isSafePublicDomainProbeAddress(address: string) {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, "ipv4")
    : family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
export type DomainDnsResult =
  | { ok: false; error: "dns_lookup_failed" }
  | {
      ok: true;
      ownership: boolean;
      dns: "ready" | "missing" | "unsafe";
      addresses: string[];
      // Snapshot for a pinned probe, never permission to resolve the host again.
      readyAddresses: string[];
    };

async function recordsOrEmpty<T>(query: Promise<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENODATA" || error.code === "ENOTFOUND")
    )
      return [];
    throw error;
  }
}

export function createDomainDnsProbe(options: {
  ingressAddresses: string[];
  createResolver?: () => DnsResolver;
  timeoutMs?: number;
}) {
  const ingress = new Set(options.ingressAddresses);
  if (
    ingress.size === 0 ||
    [...ingress].some((address) => isIP(address) !== 4 || !isSafePublicDomainProbeAddress(address))
  )
    throw new Error("Custom domains require configured ingress IPv4 addresses.");
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000)
    throw new Error("Invalid domain DNS probe timeout.");
  return async (input: { hostname: string; ownershipValue: string }): Promise<DomainDnsResult> => {
    if (!isValidCustomDomainHostname(input.hostname) || !input.ownershipValue)
      throw new Error("Invalid domain DNS probe input.");
    const resolver = options.createResolver?.() ?? new Resolver({ timeout: 2000, tries: 1 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const [ipv4, ipv6, txt] = await Promise.race([
        Promise.all([
          recordsOrEmpty(resolver.resolve4(input.hostname)),
          recordsOrEmpty(resolver.resolve6(input.hostname)),
          recordsOrEmpty(resolver.resolveTxt(`_ecs-verification.${input.hostname}`)),
        ]),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("DNS probe deadline exceeded.")), timeoutMs);
        }),
      ]);
      const addresses = [...new Set([...ipv4, ...ipv6])].sort();
      const unsafe =
        ipv4.some((address) => isIP(address) !== 4 || !isSafePublicDomainProbeAddress(address)) ||
        ipv6.some((address) => isIP(address) !== 6 || !isSafePublicDomainProbeAddress(address));
      const ready = addresses.length > 0 && addresses.every((address) => ingress.has(address));
      return {
        ok: true,
        ownership: hasDomainOwnershipRecord(txt, input.ownershipValue),
        dns: unsafe ? "unsafe" : ready ? "ready" : "missing",
        addresses,
        readyAddresses: ready && !unsafe ? addresses : [],
      };
    } catch {
      return { ok: false, error: "dns_lookup_failed" };
    } finally {
      clearTimeout(timer);
      resolver.cancel();
    }
  };
}
