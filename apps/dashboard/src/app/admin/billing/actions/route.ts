import { NextResponse } from "next/server";

import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";

/**
 * Merchant billing mutations:
 * - upgrade: create pending Growth (or paid plan) invoice
 * - pay: initialize Chapa checkout for a pending invoice
 */
export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (!context.tenantId) {
      return { ok: false, message: "tenant_required", status: 400 };
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      planId?: string;
      invoiceId?: string;
      returnUrl?: string;
    };

    const action = body.action?.trim();
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      cookie: context.cookieHeader,
    };
    if (context.requestHost) {
      headers["x-forwarded-host"] = context.requestHost;
    }

    // normalizeBaseUrl ends with `/`; join paths via URL so we never hit `//platform/...` (404).
    const base = getPlatformApiBaseUrl();
    const platformUrl = (path: string) =>
      new URL(path.replace(/^\//, ""), base).toString();

    if (action === "confirm") {
      const response = await fetch(
        platformUrl(
          `platform/tenants/${encodeURIComponent(context.tenantId)}/billing/confirm`,
        ),
        { method: "POST", headers },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          message: extractErrorText(data) ?? "billing_confirm_failed",
          status: response.status,
        };
      }
      return { ok: true, data };
    }

    if (action === "upgrade") {
      const planId = body.planId?.trim();
      if (!planId) {
        return { ok: false, message: "billing_plan_required", status: 400 };
      }

      const response = await fetch(
        platformUrl(
          `platform/tenants/${encodeURIComponent(context.tenantId)}/billing/upgrade`,
        ),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ planId }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          message: extractErrorText(data) ?? "billing_upgrade_failed",
          status: response.status,
        };
      }
      return { ok: true, data };
    }

    if (action === "pay") {
      const invoiceId = body.invoiceId?.trim();
      if (!invoiceId) {
        return { ok: false, message: "billing_invoice_required", status: 400 };
      }
      const returnUrl =
        body.returnUrl?.trim() ||
        new URL("/admin/billing", request.url).toString();

      const response = await fetch(
        platformUrl(
          `platform/tenants/${encodeURIComponent(context.tenantId)}/billing/invoices/${encodeURIComponent(invoiceId)}/pay`,
        ),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ returnUrl }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = extractErrorText(data) ?? "billing_pay_failed";
        return {
          ok: false,
          message,
          status: response.status,
        };
      }
      return { ok: true, data };
    }

    return { ok: false, message: "invalid_action", status: 400 };
  });
}

function extractErrorText(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim() && record.message !== "[object Object]") {
    return record.message.trim();
  }
  if (typeof record.error === "string" && record.error.trim() && record.error !== "[object Object]") {
    return record.error.trim();
  }
  return null;
}
