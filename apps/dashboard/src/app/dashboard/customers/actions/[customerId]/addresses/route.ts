import { withMerchantAction } from "@/lib/platform-api/action-route";
import { platformFetch } from "@/lib/platform-api/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = await context.request.text();
    const response = await platformFetch(
      `/platform/merchant/customers/${encodeURIComponent(customerId)}/addresses`,
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
      ? { data, ok: true, status: 201 }
      : {
          message: (data as { error?: string } | null)?.error ?? "customer_address_create_failed",
          ok: false,
          status: response.status,
        };
  });
}
