import {
  platformErrorSchema,
  type StorefrontTemplateCatalogItem,
  type StorefrontTemplateSelection,
  storefrontTemplateCatalogSchema,
  storefrontTemplateSelectionSchema,
} from "@ecs/contracts";

export type StorefrontTemplateCatalogResult =
  | {
      ok: true;
      templates: StorefrontTemplateCatalogItem[];
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type StorefrontTemplateSelectionResult =
  | {
      ok: true;
      selection: StorefrontTemplateSelection;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export async function getStorefrontTemplates(options: {
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
}): Promise<StorefrontTemplateCatalogResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getTemplateCatalogUrl(options.platformApiBaseUrl), {
    cache: "no-store",
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return getPlatformError(response, data, "Template catalog request failed");
  }

  const parsed = storefrontTemplateCatalogSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_template_catalog_response",
    };
  }

  return {
    ok: true,
    templates: parsed.data.templates,
  };
}

export async function selectStorefrontTemplate(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  templateKey: string;
  tenantId: string;
}): Promise<StorefrontTemplateSelectionResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    getTemplateSelectionUrl(options.platformApiBaseUrl, options.tenantId),
    {
      body: JSON.stringify({
        templateKey: options.templateKey,
      }),
      cache: "no-store",
      headers: getSelectionHeaders(options.cookieHeader),
      method: "POST",
    },
  );
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return getPlatformError(response, data, "Template selection request failed");
  }

  const parsed = storefrontTemplateSelectionSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_template_selection_response",
    };
  }

  return {
    ok: true,
    selection: parsed.data,
  };
}

function getPlatformError(response: Response, data: unknown, fallbackMessage: string) {
  const error = platformErrorSchema.safeParse(data);

  return {
    ok: false,
    status: response.status,
    message: error.success ? error.data.error : response.statusText || fallbackMessage,
  } as const;
}

function getTemplateCatalogUrl(platformApiBaseUrl: string) {
  return new URL("/platform/storefront/templates", normalizeBaseUrl(platformApiBaseUrl));
}

function getTemplateSelectionUrl(platformApiBaseUrl: string, tenantId: string) {
  return new URL(
    `/platform/tenants/${encodeURIComponent(tenantId)}/storefront/template/select`,
    normalizeBaseUrl(platformApiBaseUrl),
  );
}

function getSelectionHeaders(cookieHeader?: string | null | undefined) {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });

  if (cookieHeader?.trim()) {
    headers.set("cookie", cookieHeader.trim());
  }

  return headers;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
