type PublicStorefrontProtocolInput = {
  configuredProtocol?: string | null | undefined;
  forwardedProtocol?: string | null | undefined;
  hostname: string;
  nodeEnv?: string | null | undefined;
};

export function resolvePublicStorefrontProtocol(input: PublicStorefrontProtocolInput) {
  const configured = firstProtocol(input.configuredProtocol);
  if (configured) return configured;
  const forwarded = firstProtocol(input.forwardedProtocol);
  if (forwarded) return forwarded;
  if (input.nodeEnv === "production") return "https";
  return isLocalHostname(input.hostname) ? "http" : "https";
}

export function buildStorefrontPreviewUrl(input: {
  hostname: string;
  protocol: "http" | "https";
  token: string;
}) {
  const url = new URL("/preview", `${input.protocol}://${input.hostname}`);
  url.searchParams.set("token", input.token);
  return url.toString();
}

export function isMixedContentPreviewUrl(previewUrl: string, pageProtocol: string) {
  if (pageProtocol !== "https:") return false;
  try {
    return new URL(previewUrl).protocol !== "https:";
  } catch {
    return true;
  }
}

function firstProtocol(value?: string | null): "http" | "https" | null {
  const candidate = value?.split(",", 1)[0]?.trim().replace(/:$/, "").toLowerCase();
  return candidate === "http" || candidate === "https" ? candidate : null;
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".lvh.me");
}
