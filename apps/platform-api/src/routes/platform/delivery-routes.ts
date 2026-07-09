import type { Context, Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";

function getRequiredBodyBoolean(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];

  return typeof value === "boolean" ? value : undefined;
}

function getRequiredBodyNumberString(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const parsed = Number.parseFloat(trimmed);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return trimmed;
    }
  }

  return undefined;
}

function getRequiredBodyArray(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];

  return Array.isArray(value) ? value : undefined;
}

export function registerDeliveryRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.get("/platform/tenants/:tenantId/delivery", async (context) => {
    if (!options.getDeliverySettings) {
      return context.json({ error: "delivery_settings_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");

    if (!tenantId) {
      return context.json({ error: "missing_tenant_id" }, 400);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.getDeliverySettings({ tenantId });

    return context.json({
      delivery: result.delivery,
    });
  });

  async function updateTenantDeliverySettings(
    context: Context<{ Variables: PlatformAppVariables }>,
  ) {
    if (!options.updateDeliverySettings) {
      return context.json({ error: "delivery_settings_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");

    if (!tenantId) {
      return context.json({ error: "missing_tenant_id" }, 400);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const deliveryEnabled = getRequiredBodyBoolean(body, "deliveryEnabled");
    const pickupEnabled = getRequiredBodyBoolean(body, "pickupEnabled");
    const phoneConfirmationRequired = getRequiredBodyBoolean(body, "phoneConfirmationRequired");
    const notesEnabled = getRequiredBodyBoolean(body, "notesEnabled");
    const landmarkRequired = getRequiredBodyBoolean(body, "landmarkRequired");
    const defaultDeliveryFee = getRequiredBodyNumberString(body, "defaultDeliveryFee");
    const currency = getRequiredBodyString(body, "currency")?.toUpperCase();
    const zones = getRequiredBodyArray(body, "zones");

    if (
      deliveryEnabled === undefined ||
      pickupEnabled === undefined ||
      phoneConfirmationRequired === undefined ||
      notesEnabled === undefined ||
      landmarkRequired === undefined ||
      !defaultDeliveryFee ||
      !currency ||
      !zones
    ) {
      return context.json({ error: "invalid_delivery_settings" }, 400);
    }

    const result = await options.updateDeliverySettings({
      currency: currency,
      defaultDeliveryFee,
      deliveryEnabled,
      landmarkRequired,
      notesEnabled,
      phoneConfirmationRequired,
      pickupEnabled,
      tenantId,
      userId: session.user.id,
      zones,
    });

    return context.json({
      delivery: result.delivery,
    });
  }

  app.post("/platform/tenants/:tenantId/delivery", updateTenantDeliverySettings);
  app.put("/platform/tenants/:tenantId/delivery", updateTenantDeliverySettings);
}
