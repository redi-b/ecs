import { createProductMediaUpload } from "@/lib/merchant-media";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const input = (await context.request.json().catch(() => ({}))) as {
      byteSize?: unknown;
      context?: unknown;
      filename?: unknown;
      mimeType?: unknown;
    };
    if (
      typeof input.filename !== "string" ||
      typeof input.mimeType !== "string" ||
      typeof input.byteSize !== "number"
    ) {
      return { message: "invalid_media_asset", ok: false, status: 400 };
    }

    const result = await createProductMediaUpload(
      {
        cookieHeader: context.cookieHeader,
        platformApiBaseUrl: context.platformApiBaseUrl,
        requestHost: context.requestHost,
      },
      {
        byteSize: input.byteSize,
        ...(input.context === "media-library" ? { context: input.context } : {}),
        filename: input.filename,
        mimeType: input.mimeType,
      },
    );

    return result.ok
      ? { data: result.data, ok: true, status: 201 }
      : { message: result.error, ok: false, status: result.status };
  });
}
