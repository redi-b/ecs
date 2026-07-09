import { updateMerchantDeliverySettings, updateMerchantSettings } from "@/lib/merchant-settings";
import { withMerchantAction } from "@/lib/platform-api";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const isJson = context.request.headers.get("content-type")?.includes("application/json");
    const body = await getSettingsInput(context.request);
    const commonOptions = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
    };

    let redirectTo: string | null = null;

    if (body.mode !== "delivery") {
      const shop = await updateMerchantSettings({
        ...commonOptions,
        requestHost: context.requestHost,
        settings: {
          name: body.name,
          handle: body.handle,
        },
        tenantId: context.tenantId,
      });

      if (!shop.ok) {
        if (context.wantsJson || isJson) {
          return { ok: false, message: shop.message, status: shop.status };
        }

        return {
          ok: false,
          message: shop.message,
          status: shop.status,
          redirectPath: "/admin/settings",
          redirectStatusParam: shop.message,
          redirectStatusKey: "settingsStatus",
        };
      }

      redirectTo = shop.redirectTo;
    }

    if (context.tenantId?.trim() && body.mode !== "shop" && body.deliverySettingsAvailable) {
      const delivery = await updateMerchantDeliverySettings({
        ...commonOptions,
        delivery: body.delivery,
        tenantId: context.tenantId.trim(),
      });

      if (!delivery.ok) {
        if (context.wantsJson || isJson) {
          return { ok: false, message: delivery.message, status: delivery.status };
        }

        return {
          ok: false,
          message: delivery.message,
          status: delivery.status,
          redirectPath: "/admin/settings",
          redirectStatusParam: delivery.message,
          redirectStatusKey: "settingsStatus",
        };
      }
    }

    if (context.wantsJson || isJson) {
      return {
        ok: true,
        data: { ok: true, message: "settings_updated", redirectTo },
        status: 200,
      };
    }

    return {
      ok: true,
      data: { ok: true },
      redirectPath: "/admin/settings",
      redirectStatusParam: "settings_updated",
      redirectStatusKey: "settingsStatus",
    };
  });
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
    mode: "all" as const,
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
      zones: [] as unknown[],
    },
    deliverySettingsAvailable: formData.get("deliverySettingsAvailable") === "true",
  };
}
