import { operatorStorefrontTemplateCatalogSchema, platformErrorSchema } from "@ecs/contracts";

import { platformFetch, type PlatformRequestContext } from "@/lib/platform-api/client";

export async function getOperatorStorefrontTemplates(options: PlatformRequestContext) {
  const response = await platformFetch("/platform/operator/storefront-templates", options);
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false as const,
      message: error.success ? error.data.error : "storefront_templates_unavailable",
      status: response.status,
    };
  }
  const parsed = operatorStorefrontTemplateCatalogSchema.safeParse(data);
  return parsed.success
    ? { data: parsed.data, ok: true as const }
    : { message: "invalid_storefront_template_response", ok: false as const, status: 502 };
}

export async function forwardStorefrontTemplateCommand(
  options: PlatformRequestContext & { body: unknown; path: string },
) {
  const response = await platformFetch(options.path, {
    body: JSON.stringify(options.body),
    contentType: "json",
    cookieHeader: options.cookieHeader,
    method: "POST",
    platformApiBaseUrl: options.platformApiBaseUrl,
  });
  const data = await response.json().catch(() => ({}));
  return { data, status: response.status };
}
