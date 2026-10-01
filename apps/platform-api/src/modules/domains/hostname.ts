import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { parse } from "tldts";

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeCustomDomainHostname(value: string) {
  const input = value.trim();
  // domainToASCII accepts a hostname, not a merchant URL. Reject URL syntax
  // before conversion so a pasted path/port cannot silently become a claim.
  if (/[\s/\\:@?#%*[\]]/.test(input) || /\p{Cc}/u.test(input)) return "";
  try {
    return domainToASCII(input).toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function isValidCustomDomainHostname(value: string) {
  if (
    !hostnamePattern.test(value) ||
    isIP(value) ||
    domainToASCII(value) !== value ||
    value.endsWith(".et")
  )
    return false;
  const result = parse(value, { allowPrivateDomains: true });
  return (
    result.hostname === value && result.domain !== null && (result.isIcann || result.isPrivate)
  );
}

export function isReservedCustomDomainHostname(hostname: string, platformBaseDomain = "ecset.dev") {
  const base = normalizeCustomDomainHostname(platformBaseDomain);
  return (
    hostname === "ecset.dev" ||
    hostname.endsWith(".ecset.dev") ||
    hostname === base ||
    hostname.endsWith(`.${base}`)
  );
}
