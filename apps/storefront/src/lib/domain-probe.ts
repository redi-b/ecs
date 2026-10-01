import { domainProbeIdentitySchema } from "@ecs/contracts";

const headers = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};
const unavailable = (status: number) =>
  Response.json({ error: "domain_probe_unavailable" }, { status, headers });

export async function getDomainProbeResponse(options: {
  request: Request;
  platformApiBaseUrl: string;
  fetcher?: (request: Request) => Promise<Response>;
}) {
  if (options.request.method !== "GET") return unavailable(405);
  const hostname = (options.request.headers.get("host") ?? new URL(options.request.url).hostname)
    .toLowerCase()
    .replace(/:443$/, "");
  const nonce = options.request.headers.get("x-ecs-domain-probe") ?? "";
  if (
    !/^[a-f0-9]{32}$/.test(nonce) ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]+$/.test(hostname)
  )
    return unavailable(400);
  try {
    const request = new Request(
      new URL("/platform/storefront/domain-probe", options.platformApiBaseUrl),
      {
        headers: {
          "x-forwarded-host": hostname,
          "x-ecs-domain-probe": nonce,
          Accept: "application/json",
        },
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    const response = await (options.fetcher ?? fetch)(request);
    if (!response.ok) return unavailable(response.status === 404 ? 404 : 503);
    if (
      response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
        "application/json" ||
      !response.body
    )
      return unavailable(503);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return unavailable(503);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const parsed = domainProbeIdentitySchema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!parsed.success || parsed.data.hostname !== hostname || parsed.data.nonce !== nonce)
      return unavailable(503);
    return Response.json(parsed.data, { headers });
  } catch {
    return unavailable(503);
  }
}
