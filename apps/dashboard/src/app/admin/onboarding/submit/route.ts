import { NextResponse } from "next/server";

import { updateMerchantDeliverySettings } from "@/lib/merchant-settings";
import { createTenantShop } from "@/lib/platform-onboarding";
import { requestWantsJson } from "@/lib/request-wants-json";

export async function POST(request: Request) {
  const wantsJson = requestWantsJson(request);
  const payload = await readOnboardingPayload(request);
  const shopName = payload.shopName;
  const handle = payload.handle;
  const templateKey = payload.templateKey;
  const businessCategory = payload.businessCategory;
  const contactPhone = payload.contactPhone;
  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!cookieHeader) {
    return failOnboarding(request, "auth_required", payload, wantsJson);
  }

  if (!shopName || !handle || !templateKey) {
    return failOnboarding(request, "missing_required_fields", payload, wantsJson);
  }

  const platformApiBaseUrl = getPlatformBaseUrl();
  const createResult = await createTenantShop({
    cookieHeader,
    input: {
      ...(businessCategory ? { businessCategory } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      handle,
      name: shopName,
      templateKey,
    },
    platformApiBaseUrl,
  });

  if (!createResult.ok) {
    console.error("[onboarding/submit] shop create failed", {
      handle,
      message: createResult.message,
      status: createResult.status,
    });
    return failOnboarding(request, createResult.message, payload, wantsJson);
  }

  // Apply checkout preferences chosen during onboarding (after provision).
  const tenantId = createResult.mutation.tenant.id;
  let deliveryPrefsApplied = true;
  if (tenantId) {
    const deliveryResult = await updateMerchantDeliverySettings({
      cookieHeader,
      delivery: {
        currency: "ETB",
        defaultDeliveryFee: "0",
        deliveryEnabled: payload.deliveryEnabled,
        landmarkRequired: false,
        notesEnabled: true,
        phoneConfirmationRequired: payload.phoneConfirmationRequired,
        pickupEnabled: payload.pickupEnabled,
        zones: [],
      },
      platformApiBaseUrl,
      tenantId,
    });

    if (!deliveryResult.ok) {
      deliveryPrefsApplied = false;
      console.warn("[onboarding/submit] delivery prefs not applied", {
        handle,
        message: deliveryResult.message,
        tenantId,
      });
    }
  } else {
    deliveryPrefsApplied = false;
  }

  const redirectTo =
    createResult.mutation.redirectTo ??
    `http://${createResult.mutation.tenant.primaryDomain.hostname}/admin`;

  if (wantsJson) {
    return NextResponse.json({
      ok: true as const,
      redirectTo,
      deliveryPrefsApplied,
      ...(deliveryPrefsApplied
        ? {}
        : { warning: "delivery_prefs_not_applied" as const }),
    });
  }

  const redirectUrl = new URL(redirectTo);
  if (!deliveryPrefsApplied) {
    redirectUrl.searchParams.set("onboardingWarning", "delivery_prefs_not_applied");
  }
  return NextResponse.redirect(redirectUrl.toString(), { status: 303 });
}

async function readOnboardingPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      businessCategory?: unknown;
      contactPhone?: unknown;
      deliveryEnabled?: unknown;
      handle?: unknown;
      phoneConfirmationRequired?: unknown;
      pickupEnabled?: unknown;
      shopName?: unknown;
      templateKey?: unknown;
    } | null;
    return {
      businessCategory: optionalString(body?.businessCategory),
      contactPhone: optionalString(body?.contactPhone),
      deliveryEnabled: optionalBoolean(body?.deliveryEnabled, true),
      handle: requiredString(body?.handle),
      phoneConfirmationRequired: optionalBoolean(body?.phoneConfirmationRequired, true),
      pickupEnabled: optionalBoolean(body?.pickupEnabled, true),
      shopName: requiredString(body?.shopName),
      templateKey: requiredString(body?.templateKey),
    };
  }

  const formData = await request.formData();
  return {
    businessCategory: getOptionalString(formData, "businessCategory"),
    contactPhone: getOptionalString(formData, "contactPhone"),
    deliveryEnabled: formData.get("deliveryEnabled") !== "false",
    handle: getRequiredString(formData, "handle"),
    phoneConfirmationRequired: formData.get("phoneConfirmationRequired") !== "false",
    pickupEnabled: formData.get("pickupEnabled") !== "false",
    shopName: getRequiredString(formData, "shopName"),
    templateKey: getRequiredString(formData, "templateKey"),
  };
}

function optionalBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function failOnboarding(
  request: Request,
  error: string,
  payload: {
    businessCategory?: string | undefined;
    contactPhone?: string | undefined;
    handle: string | null;
    shopName: string | null;
  },
  wantsJson: boolean,
) {
  if (wantsJson) {
    const status =
      error === "auth_required"
        ? 401
        : error === "missing_required_fields"
          ? 400
          : 503;
    return NextResponse.json({ error, ok: false as const }, { status });
  }
  return redirectToOnboarding(request, error, payload);
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function redirectToOnboarding(
  request: Request,
  error: string,
  payload: {
    businessCategory?: string | undefined;
    contactPhone?: string | undefined;
    handle: string | null;
    shopName: string | null;
  },
) {
  const url = new URL("/admin/onboarding", getRequestOrigin(request));

  url.searchParams.set("error", error);
  for (const [key, value] of Object.entries({
    shopName: payload.shopName,
    handle: payload.handle,
    businessCategory: payload.businessCategory,
    contactPhone: payload.contactPhone,
  })) {
    if (value) url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, { status: 303 });
}

function getPlatformBaseUrl() {
  return normalizeBaseUrl(process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000");
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
