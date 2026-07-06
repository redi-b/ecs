import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { updateMerchantDeliverySettings, updateMerchantSettings } from "@/lib/merchant-settings";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  const isJson = request.headers.get("content-type")?.includes("application/json");
  const tenantId = new URL(request.url).searchParams.get("tenantId");
  const body = await getSettingsInput(request);
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const commonOptions = {
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
  };

  let redirectTo: string | null = null;

  if (body.mode !== "delivery") {
    const shop = await updateMerchantSettings({
      ...commonOptions,
      requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
      settings: {
        name: body.name,
        handle: body.handle,
      },
      tenantId,
    });

    if (!shop.ok) {
      return respond(request, wantsJson, shop.message, shop.status, null);
    }

    redirectTo = shop.redirectTo;
  }

  if (tenantId?.trim() && body.mode !== "shop" && body.deliverySettingsAvailable) {
    const delivery = await updateMerchantDeliverySettings({
      ...commonOptions,
      delivery: body.delivery,
      tenantId: tenantId.trim(),
    });

    if (!delivery.ok) {
      return respond(request, wantsJson, delivery.message, delivery.status, null);
    }
  }

  return respond(request, wantsJson || isJson, "settings_updated", 200, redirectTo);
}

async function getSettingsInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      delivery?: Record<string, unknown>;
      handle?: unknown;
      mode?: unknown;
      name?: unknown;
    };
    const delivery = body.delivery ?? {};

    return {
      mode: body.mode === "delivery" || body.mode === "shop" ? body.mode : "all",
      name: String(body.name ?? "").trim(),
      handle: String(body.handle ?? "").trim(),
      delivery: {
        deliveryEnabled: delivery.deliveryEnabled === true,
        pickupEnabled: delivery.pickupEnabled === true,
        phoneConfirmationRequired: delivery.phoneConfirmationRequired === true,
        notesEnabled: delivery.notesEnabled === true,
        landmarkRequired: delivery.landmarkRequired === true,
        defaultDeliveryFee: String(delivery.defaultDeliveryFee ?? "0").trim(),
        currency: "ETB",
        zones: [],
      },
      deliverySettingsAvailable: Boolean(body.delivery),
    };
  }

  const formData = await request.formData();

  return {
    mode: "all",
    name: String(formData.get("name") ?? "").trim(),
    handle: String(formData.get("handle") ?? "").trim(),
    delivery: {
      deliveryEnabled: formData.get("deliveryEnabled") === "on",
      pickupEnabled: formData.get("pickupEnabled") === "on",
      phoneConfirmationRequired: formData.get("phoneConfirmationRequired") === "on",
      notesEnabled: formData.get("notesEnabled") === "on",
      landmarkRequired: formData.get("landmarkRequired") === "on",
      defaultDeliveryFee: String(formData.get("defaultDeliveryFee") ?? "0").trim(),
      currency: String(formData.get("currency") ?? "ETB").trim().toUpperCase(),
      zones: [],
    },
    deliverySettingsAvailable: formData.get("deliverySettingsAvailable") === "true",
  };
}

function respond(
  request: Request,
  wantsJson: boolean | undefined,
  message: string,
  status: number,
  redirectTo: string | null,
) {
  if (wantsJson) {
    return NextResponse.json(
      status >= 200 && status < 300 ? { ok: true, message, redirectTo } : { error: message },
      { status },
    );
  }

  const url = new URL("/admin/settings", getRequestOrigin(request));
  url.searchParams.set("settingsStatus", message);

  const tenantId = new URL(request.url).searchParams.get("tenantId");

  if (tenantId?.trim()) {
    url.searchParams.set("tenantId", tenantId.trim());
  }

  return NextResponse.redirect(url, { status: 303 });
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}
