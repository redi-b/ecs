import type { Context, Hono } from "hono";
import { z } from "zod";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getPaginationValue } from "../shared.js";

const inquiryStatusSchema = z.enum(["new", "read", "resolved", "archived"]);

async function authorize(context: Context<{ Variables: PlatformAppVariables }>, options: PlatformAppOptions) {
  const session = await options.getSession?.(context.req.raw.headers);
  if (!session) return { ok: false as const, response: context.json({ error: "auth_required" }, 401) };
  const tenantId = context.req.param("tenantId");
  const access = tenantId ? await options.authorizeDashboardForTenant?.({ tenantId, userId: session.user.id }) : null;
  if (!tenantId || !access?.ok) return { ok: false as const, response: context.json({ error: "dashboard_forbidden" }, 403) };
  return { ok: true as const, tenantId };
}

export function registerPlatformInquiryRoutes(app: Hono<{ Variables: PlatformAppVariables }>, options: PlatformAppOptions) {
  app.get("/platform/tenants/:tenantId/inquiries", async (context) => {
    const access = await authorize(context, options); if (!access.ok) return access.response;
    if (!options.listStorefrontInquiries) return context.json({ error: "inquiries_unavailable" }, 503);
    return context.json(await options.listStorefrontInquiries({
      tenantId: access.tenantId,
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      ...(context.req.query("q")?.trim() ? { q: context.req.query("q")!.trim() } : {}),
      ...(context.req.query("status")?.trim() ? { status: context.req.query("status")!.trim() } : {}),
      ...(context.req.query("type")?.trim() ? { type: context.req.query("type")!.trim() } : {}),
    }));
  });

  app.get("/platform/tenants/:tenantId/inquiries/:inquiryId", async (context) => {
    const access = await authorize(context, options); if (!access.ok) return access.response;
    if (!options.getStorefrontInquiry) return context.json({ error: "inquiries_unavailable" }, 503);
    const result = await options.getStorefrontInquiry({ inquiryId: context.req.param("inquiryId"), tenantId: access.tenantId });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.patch("/platform/tenants/:tenantId/inquiries/:inquiryId", async (context) => {
    const access = await authorize(context, options); if (!access.ok) return access.response;
    if (!options.updateStorefrontInquiryStatus) return context.json({ error: "inquiries_unavailable" }, 503);
    const body = await context.req.json().catch(() => null);
    const status = inquiryStatusSchema.safeParse(body?.status);
    if (!status.success) return context.json({ error: "invalid_inquiry_status" }, 400);
    const result = await options.updateStorefrontInquiryStatus({ inquiryId: context.req.param("inquiryId"), status: status.data, tenantId: access.tenantId });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });
}
