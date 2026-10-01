import { domainProbeIdentitySchema } from "@ecs/contracts";
import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

export function registerPlatformDomainProbeRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Pick<PlatformAppOptions, "getDomainProbeIdentity">,
) {
  app.get("/platform/storefront/domain-probe", async (context) => {
    context.header("cache-control", "private, no-store");
    context.header("x-robots-tag", "noindex, nofollow");
    context.header("referrer-policy", "no-referrer");
    context.header("x-content-type-options", "nosniff");
    const nonce = context.req.header("x-ecs-domain-probe") ?? "";
    if (!/^[a-f0-9]{32}$/.test(nonce)) return context.json({ error: "invalid_domain_probe" }, 400);
    if (!options.getDomainProbeIdentity)
      return context.json({ error: "domain_probe_unavailable" }, 404);
    const hostname = context.req.header("x-forwarded-host") ?? context.req.header("host") ?? "";
    try {
      const identity = await options.getDomainProbeIdentity({ hostname, nonce });
      if (!identity) return context.json({ error: "domain_probe_unavailable" }, 404);
      const parsed = domainProbeIdentitySchema.safeParse(identity);
      if (!parsed.success || parsed.data.hostname !== hostname || parsed.data.nonce !== nonce)
        return context.json({ error: "domain_probe_unavailable" }, 503);
      return context.json(parsed.data);
    } catch {
      return context.json({ error: "domain_probe_unavailable" }, 503);
    }
  });
}
