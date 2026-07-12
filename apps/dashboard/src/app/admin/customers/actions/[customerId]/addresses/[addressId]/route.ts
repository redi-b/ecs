import { withMerchantAction } from "@/lib/platform-api/action-route";
import { platformFetch } from "@/lib/platform-api/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ addressId: string; customerId: string }> },
) {
  const { addressId, customerId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = await context.request.text();
    const response = await platformFetch(
      `/platform/merchant/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
      {
        body,
        contentType: "json",
        cookieHeader: context.cookieHeader,
        method: "POST",
        platformApiBaseUrl: context.platformApiBaseUrl,
        requestHost: context.requestHost,
      },
    );
    const data = await response.json().catch(() => null);
    return response.ok
      ? { data, ok: true }
      : {
          message: (data as { error?: string } | null)?.error ?? "customer_address_update_failed",
          ok: false,
          status: response.status,
        };
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ addressId: string; customerId: string }> },
) {
  const { addressId, customerId } = await params;
  return withMerchantAction(request, async (context) => {
    const response = await platformFetch(
      `/platform/merchant/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
      {
        cookieHeader: context.cookieHeader,
        method: "DELETE",
        platformApiBaseUrl: context.platformApiBaseUrl,
        requestHost: context.requestHost,
      },
    );
    const data = await response.json().catch(() => null);
    return response.ok
      ? { data, ok: true }
      : {
          message: (data as { error?: string } | null)?.error ?? "customer_address_delete_failed",
          ok: false,
          status: response.status,
        };
  });
}
