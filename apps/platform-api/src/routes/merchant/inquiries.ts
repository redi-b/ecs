import type { Hono } from "hono";
import { z } from "zod";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

const inquiryStatusSchema = z.enum(["new", "read", "resolved", "archived"]);

export function registerMerchantInquiryRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/inquiries", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.listStorefrontInquiries) return context.json({ error: "inquiries_unavailable" }, 503);

    const result = await options.listStorefrontInquiries({
      tenantId: merchant.result.context.tenantId,
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      ...(context.req.query("q")?.trim() ? { q: context.req.query("q")!.trim() } : {}),
      ...(context.req.query("status")?.trim() ? { status: context.req.query("status")!.trim() } : {}),
      ...(context.req.query("type")?.trim() ? { type: context.req.query("type")!.trim() } : {}),
    });
    return context.json(result);
  });

  app.get("/platform/merchant/inquiries/:inquiryId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.getStorefrontInquiry) return context.json({ error: "inquiries_unavailable" }, 503);
    const result = await options.getStorefrontInquiry({ inquiryId: context.req.param("inquiryId"), tenantId: merchant.result.context.tenantId });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.patch("/platform/merchant/inquiries/:inquiryId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.updateStorefrontInquiryStatus) return context.json({ error: "inquiries_unavailable" }, 503);
    const body = await context.req.json().catch(() => null);
    const status = inquiryStatusSchema.safeParse(body?.status);
    if (!status.success) return context.json({ error: "invalid_inquiry_status" }, 400);
    const result = await options.updateStorefrontInquiryStatus({ inquiryId: context.req.param("inquiryId"), status: status.data, tenantId: merchant.result.context.tenantId });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });
}
