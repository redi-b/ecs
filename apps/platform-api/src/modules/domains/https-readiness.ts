import { randomBytes } from "node:crypto";
import type { ClientRequest, IncomingMessage, OutgoingHttpHeaders } from "node:http";
import { type RequestOptions, request } from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity, rootCertificates } from "node:tls";
import { domainProbeIdentitySchema } from "@ecs/contracts";
import { isSafePublicDomainProbeAddress } from "./dns-readiness.js";
import { isValidCustomDomainHostname } from "./service.js";

export type DomainProbeRequest = (
  options: Omit<RequestOptions, "headers"> & { headers: OutgoingHttpHeaders },
  callback: (response: IncomingMessage) => void,
) => ClientRequest;
export type DomainHttpsResult =
  | { ok: false; error: "https_probe_failed" }
  | { ok: true; https: "valid" | "pending" | "invalid" | "wrong_shop" };
type ProbeInput = { hostname: string; tenantId: string; domainId: string; addresses?: string[] };
const certificateErrors = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_REVOKED",
  "INVALID_CA",
]);

export function createDomainHttpsProbe(options: {
  ingressAddresses: string[];
  request?: DomainProbeRequest;
  timeoutMs?: number;
}) {
  const ingress = [...new Set(options.ingressAddresses)].sort();
  if (
    !ingress.length ||
    ingress.length > 8 ||
    ingress.some((address) => isIP(address) !== 4 || !isSafePublicDomainProbeAddress(address))
  )
    throw new Error("HTTPS probes require public ingress IPv4 addresses.");
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000)
    throw new Error("Invalid HTTPS probe timeout.");
  const probeAddress = async (
    input: ProbeInput,
    address: string,
    budgetMs: number,
  ): Promise<DomainHttpsResult> => {
    const nonce = randomBytes(16).toString("hex");
    return new Promise((resolve) => {
      let outgoing: ClientRequest | undefined;
      let incoming: IncomingMessage | undefined;
      let settled = false;
      const settle = (result: DomainHttpsResult, abort = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
        if (abort) {
          incoming?.destroy();
          outgoing?.destroy();
        }
      };
      const timer = setTimeout(
        () => settle({ ok: false, error: "https_probe_failed" }, true),
        budgetMs,
      );
      try {
        outgoing = (options.request ?? request)(
          {
            protocol: "https:",
            hostname: address,
            port: 443,
            servername: input.hostname,
            method: "GET",
            path: "/.well-known/ecs-domain-verification",
            headers: {
              Host: input.hostname,
              Accept: "application/json",
              "Cache-Control": "no-cache",
              "x-ecs-domain-probe": nonce,
            },
            rejectUnauthorized: true,
            // Do not let NODE_EXTRA_CA_CERTS or an internal system CA turn a
            // staging/Origin CA certificate into public activation evidence.
            ca: [...rootCertificates],
            checkServerIdentity: (_, certificate) =>
              checkServerIdentity(input.hostname, certificate),
            agent: false,
            maxHeaderSize: 8192,
          },
          (response) => {
            if (settled) {
              response.destroy();
              return;
            }
            incoming = response;
            const chunks: Buffer[] = [];
            let bytes = 0;
            response.on("data", (chunk: Buffer | string) => {
              if (settled) return;
              const data = Buffer.from(chunk);
              bytes += data.length;
              if (bytes > 4096) {
                settle({ ok: true, https: "invalid" }, true);
                return;
              }
              chunks.push(data);
            });
            response.on("error", () => settle({ ok: false, error: "https_probe_failed" }, true));
            response.on("aborted", () => settle({ ok: false, error: "https_probe_failed" }, true));
            response.on("end", () => {
              if (settled) return;
              if (response.statusCode === 404) {
                settle({ ok: true, https: "pending" });
                return;
              }
              if ((response.statusCode ?? 0) >= 500) {
                settle({ ok: false, error: "https_probe_failed" });
                return;
              }
              if (
                response.statusCode !== 200 ||
                response.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !==
                  "application/json"
              ) {
                settle({ ok: true, https: "invalid" });
                return;
              }
              try {
                const parsed = domainProbeIdentitySchema.safeParse(
                  JSON.parse(Buffer.concat(chunks).toString("utf8")),
                );
                if (!parsed.success || parsed.data.nonce !== nonce) {
                  settle({ ok: true, https: "invalid" });
                  return;
                }
                const identity = parsed.data;
                const sameShop =
                  identity.hostname === input.hostname &&
                  identity.tenantId === input.tenantId &&
                  identity.domainId === input.domainId;
                settle({ ok: true, https: sameShop ? "valid" : "wrong_shop" });
              } catch {
                settle({ ok: true, https: "invalid" });
              }
            });
          },
        );
        outgoing.on("error", (error: NodeJS.ErrnoException) =>
          settle(
            certificateErrors.has(error.code ?? "")
              ? { ok: true, https: "invalid" }
              : { ok: false, error: "https_probe_failed" },
            true,
          ),
        );
        outgoing.end();
      } catch {
        settle({ ok: false, error: "https_probe_failed" }, true);
      }
    });
  };
  return async (input: ProbeInput): Promise<DomainHttpsResult> => {
    if (!isValidCustomDomainHostname(input.hostname) || !input.tenantId || !input.domainId)
      throw new Error("Invalid HTTPS probe identity.");
    const addresses = [...new Set(input.addresses ?? ingress)].sort();
    if (!addresses.length || addresses.some((address) => !ingress.includes(address)))
      throw new Error("HTTPS probe targets must be configured ingress addresses.");
    const deadline = Date.now() + timeoutMs;
    for (const address of addresses) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { ok: false, error: "https_probe_failed" };
      const result = await probeAddress(input, address, remaining);
      if (!result.ok || result.https !== "valid") return result;
    }
    return { ok: true, https: "valid" };
  };
}
