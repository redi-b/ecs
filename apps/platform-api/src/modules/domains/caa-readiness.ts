import type { CaaRecord } from "node:dns";
import { Resolver } from "node:dns/promises";
import { isValidCustomDomainHostname } from "./service.js";

type CaaResolver = {
  resolveCaa: (hostname: string) => Promise<CaaRecord[]>;
  cancel: () => void;
};
export type DomainCaaResult =
  | { ok: false; error: "caa_lookup_failed" }
  | { ok: true; allowed: boolean; checkedHostname: string | null; reason: CaaReason };

type CaaReason =
  | "allowed"
  | "issuer_not_allowed"
  | "http01_not_allowed"
  | "account_restricted"
  | "unknown_critical_property"
  | "unsupported_parameters"
  | "invalid_record";

function issuePermission(value: string, accountUri?: string): CaaReason {
  const [issuer, ...parameters] = value.split(";");
  if (issuer?.trim().toLowerCase() !== "letsencrypt.org") return "issuer_not_allowed";
  const seen = new Set<string>();
  for (const parameter of parameters) {
    if (!parameter.trim()) continue;
    const equals = parameter.indexOf("=");
    if (equals < 1) return "unsupported_parameters";
    const name = parameter.slice(0, equals).trim().toLowerCase();
    const setting = parameter.slice(equals + 1).trim();
    if (seen.has(name)) return "unsupported_parameters";
    seen.add(name);
    if (name === "validationmethods") {
      if (
        !setting
          .split(",")
          .map((method) => method.trim())
          .includes("http-01")
      )
        return "http01_not_allowed";
    } else if (name === "accounturi") {
      if (!accountUri || setting !== accountUri) return "account_restricted";
    } else return "unsupported_parameters";
  }
  return "allowed";
}

function permission(records: CaaRecord[], accountUri?: string): CaaReason {
  const issues: string[] = [];
  for (const record of records) {
    if (!Number.isInteger(record.critical) || record.critical < 0 || record.critical > 255)
      return "invalid_record";
    const properties = Object.entries(record).filter(([name]) => name !== "critical");
    if (properties.length !== 1) return "invalid_record";
    for (const [tag, value] of properties) {
      if (typeof value !== "string") return "invalid_record";
      const name = tag.toLowerCase();
      if (!["issue", "issuewild", "iodef"].includes(name) && (record.critical & 128) !== 0)
        return "unknown_critical_property";
      if (name === "issue") issues.push(value);
    }
  }
  if (!issues.length) return "allowed"; // issuewild does not restrict exact hosts.
  let reason: CaaReason = "issuer_not_allowed";
  for (const issue of issues) {
    const result = issuePermission(issue, accountUri);
    if (result === "allowed") return result;
    if (result !== "issuer_not_allowed") reason = result;
  }
  return reason;
}

export function createDomainCaaProbe(
  options: { createResolver?: () => CaaResolver; accountUri?: string; timeoutMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000)
    throw new Error("Invalid CAA probe timeout.");
  return async (hostname: string): Promise<DomainCaaResult> => {
    if (!isValidCustomDomainHostname(hostname)) throw new Error("Invalid CAA probe hostname.");
    const resolver = options.createResolver?.() ?? new Resolver({ timeout: 2000, tries: 1 });
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const walk = async (): Promise<DomainCaaResult> => {
      for (let name = hostname; name; name = name.split(".").slice(1).join(".")) {
        if (expired) throw new Error("CAA probe deadline exceeded.");
        let records: CaaRecord[];
        try {
          // DNS resolution follows aliases. On an empty result RFC 8659 climbs
          // the original query name, not the CNAME destination's parent tree.
          records = await resolver.resolveCaa(name);
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error.code === "ENODATA" || error.code === "ENOTFOUND")
          )
            records = [];
          else throw error;
        }
        if (!records.length) continue;
        const reason = permission(records, options.accountUri);
        return { ok: true, allowed: reason === "allowed", checkedHostname: name, reason };
      }
      return { ok: true, allowed: true, checkedHostname: null, reason: "allowed" };
    };
    try {
      return await Promise.race([
        walk(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            expired = true;
            reject(new Error("CAA probe deadline exceeded."));
          }, timeoutMs);
        }),
      ]);
    } catch {
      return { ok: false, error: "caa_lookup_failed" };
    } finally {
      clearTimeout(timer);
      resolver.cancel();
    }
  };
}
