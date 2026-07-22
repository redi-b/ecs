import { getAdminHeaders } from "./product/medusa-http.js";

type Options = {
  adminApiToken?: string | undefined;
  medusaInternalUrl: string;
  fetcher?: typeof fetch;
};

export type ManualOrderItemInput = {
  quantity: number;
  variantId: string;
};

export type ManualOrderAddressInput = {
  address1?: string | null | undefined;
  address2?: string | null | undefined;
  city?: string | null | undefined;
  countryCode?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  phone?: string | null | undefined;
  postalCode?: string | null | undefined;
  province?: string | null | undefined;
};

export type ManualOrderCreateInput = {
  customerEmail: string;
  customerId?: string | null | undefined;
  items: ManualOrderItemInput[];
  note?: string | null | undefined;
  regionId: string;
  salesChannelId: string;
  shippingAddress?: ManualOrderAddressInput | null | undefined;
  shippingOptionId?: string | null | undefined;
  tenantId: string;
  userId: string;
};

export type ManualOrderResult =
  | {
      ok: true;
      order: {
        id: string;
        displayId: string | number | null;
        status: string;
      };
    }
  | {
      ok: false;
      error: string;
      status: 400 | 401 | 404 | 503;
    };

/**
 * Creates a Medusa draft order and converts it to a real order (COD/manual path).
 * Requires @medusajs/draft-order plugin enabled in medusa-config.
 */
export function createMedusaManualOrderService(options: Options) {
  const fetcher = options.fetcher ?? fetch;
  const base = options.medusaInternalUrl.replace(/\/$/, "");
  const headers = () => getAdminHeaders(options.adminApiToken ?? "");

  function unavailable(error = "commerce_backend_unavailable"): ManualOrderResult {
    if (!options.adminApiToken?.trim()) {
      return { error: "commerce_credentials_invalid", ok: false, status: 401 };
    }
    return { error, ok: false, status: 503 };
  }

  async function createManualOrder(input: ManualOrderCreateInput): Promise<ManualOrderResult> {
    if (!input.items.length) {
      return { error: "invalid_manual_order", ok: false, status: 400 };
    }
    if (!input.customerEmail.trim()) {
      return { error: "invalid_manual_order", ok: false, status: 400 };
    }

    const shipping = input.shippingAddress
      ? {
          address_1: input.shippingAddress.address1 ?? undefined,
          address_2: input.shippingAddress.address2 ?? undefined,
          city: input.shippingAddress.city ?? undefined,
          country_code: (input.shippingAddress.countryCode ?? "et").toLowerCase(),
          first_name: input.shippingAddress.firstName ?? undefined,
          last_name: input.shippingAddress.lastName ?? undefined,
          phone: input.shippingAddress.phone ?? undefined,
          postal_code: input.shippingAddress.postalCode ?? undefined,
          province: input.shippingAddress.province ?? undefined,
        }
      : undefined;

    const createBody = {
      email: input.customerEmail.trim().toLowerCase(),
      region_id: input.regionId,
      sales_channel_id: input.salesChannelId,
      ...(input.customerId ? { customer_id: input.customerId } : {}),
      items: input.items.map((item) => ({
        quantity: item.quantity,
        variant_id: item.variantId,
      })),
      ...(shipping
        ? {
            shipping_address: shipping,
            billing_address: shipping,
          }
        : {}),
      metadata: {
        created_by_user_id: input.userId,
        created_from: "dashboard_manual_order",
        note: input.note?.trim() || null,
        payment_method: "cod",
        checkout_type: "cod",
        platform_tenant_id: input.tenantId,
      },
    };

    const created = await fetcher(`${base}/admin/draft-orders`, {
      body: JSON.stringify(createBody),
      headers: headers(),
      method: "POST",
    }).catch(() => null);

    if (!created?.ok) {
      if (!created) return unavailable();
      if (created.status === 401 || created.status === 403) {
        return { error: "commerce_credentials_invalid", ok: false, status: 401 };
      }
      if (created.status === 400 || created.status === 422 || (created.status >= 400 && created.status < 500 && created.status !== 404)) {
        return { error: "invalid_manual_order", ok: false, status: 400 };
      }
      // Plugin may be missing — treat as setup outage, not merchant validation.
      if (created.status === 404) {
        return { error: "draft_order_unavailable", ok: false, status: 503 };
      }
      return unavailable();
    }

    const createdBody = (await created.json().catch(() => ({}))) as {
      draft_order?: { id?: string };
      order?: { id?: string };
    };
    const draftId = createdBody.draft_order?.id ?? createdBody.order?.id;
    if (!draftId) {
      return { error: "invalid_manual_order", ok: false, status: 400 };
    }

    // Optional shipping method when provisioned option id is known.
    if (input.shippingOptionId) {
      await fetcher(`${base}/admin/draft-orders/${encodeURIComponent(draftId)}/shipping-methods`, {
        body: JSON.stringify({
          shipping_option_id: input.shippingOptionId,
        }),
        headers: headers(),
        method: "POST",
      }).catch(() => null);
    }

    const converted = await fetcher(
      `${base}/admin/draft-orders/${encodeURIComponent(draftId)}/convert-to-order`,
      {
        headers: headers(),
        method: "POST",
      },
    ).catch(() => null);

    if (!converted?.ok) {
      // Leave draft if convert fails — surface a clear error.
      if (
        converted?.status === 400 ||
        converted?.status === 422 ||
        (converted != null && converted.status >= 400 && converted.status < 500)
      ) {
        return { error: "manual_order_convert_failed", ok: false, status: 400 };
      }
      return unavailable("manual_order_convert_failed");
    }

    const orderBody = (await converted.json().catch(() => ({}))) as {
      order?: { display_id?: number | string; id?: string; status?: string };
    };
    const order = orderBody.order;
    if (!order?.id) {
      return { error: "manual_order_convert_failed", ok: false, status: 503 };
    }

    return {
      ok: true,
      order: {
        displayId: order.display_id ?? null,
        id: order.id,
        status: order.status ?? "pending",
      },
    };
  }

  return { createManualOrder };
}
