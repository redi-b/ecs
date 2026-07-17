import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { ensureCommerceBootstrap } from "../../../../lib/commerce-bootstrap";

function getInternalToken(request: MedusaRequest) {
  return request.headers["x-platform-internal-token"];
}

function getExpectedInternalToken() {
  return (
    process.env.PLATFORM_INTERNAL_API_TOKEN ??
    (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token")
  );
}

/**
 * Platform-only bootstrap: ETB region + secret admin API key.
 * Auth: x-platform-internal-token (same trust boundary as provision-tenant).
 * Returns the secret token once; platform must store it encrypted.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const expectedToken = getExpectedInternalToken();

  if (!expectedToken || getInternalToken(req) !== expectedToken) {
    return res.status(401).json({
      error: "internal_auth_required",
    });
  }

  const body =
    typeof req.body === "object" && req.body !== null
      ? (req.body as { forceNewKey?: boolean; title?: string })
      : {};

  try {
    const titleBase =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "Platform API Secret";
    const title =
      body.forceNewKey === true
        ? `${titleBase} ${new Date().toISOString()}`
        : titleBase;

    const result = await ensureCommerceBootstrap(req.scope, {
      secretKeyTitle: title,
      createdBy: "platform-bootstrap-admin",
    });

    return res.status(201).json({
      ok: true,
      medusaAdminApiToken: result.medusaAdminApiToken,
      regionCreated: result.regionCreated,
      title: result.title,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "commerce_bootstrap_failed";
    return res.status(500).json({
      error: "commerce_bootstrap_failed",
      message,
    });
  }
}
