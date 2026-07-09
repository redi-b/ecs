import {
  platformErrorSchema,
  type StorefrontDraft,
  storefrontDraftSchema,
  type StorefrontPublish,
  storefrontPublishSchema,
  type StorefrontTemplateCatalogItem,
  type StorefrontTemplateSelection,
  storefrontTemplateCatalogSchema,
  storefrontTemplateSelectionSchema,
} from "@ecs/contracts";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

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

export type StorefrontDraftResult =
  | {
      ok: true;
      draft: StorefrontDraft["draft"];
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type StorefrontDraftUpdateResult = StorefrontDraftResult;

export type StorefrontPublishResult =
  | {
      ok: true;
      publish: StorefrontPublish["storefront"];
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

export async function getStorefrontDraft(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
}): Promise<StorefrontDraftResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getStorefrontDraftUrl(options.platformApiBaseUrl, options.tenantId), {
    cache: "no-store",
    headers: getJsonHeaders(options.cookieHeader),
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return getPlatformError(response, data, "Storefront draft request failed");
  }

  const parsed = storefrontDraftSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_storefront_draft_response",
    };
  }

  return {
    ok: true,
    draft: parsed.data.draft,
  };
}

export async function updateStorefrontDraft(options: {
  cookieHeader?: string | null | undefined;
  data: unknown;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
  themeTokens: unknown;
}): Promise<StorefrontDraftUpdateResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getStorefrontDraftUrl(options.platformApiBaseUrl, options.tenantId), {
    body: JSON.stringify({
      data: options.data,
      themeTokens: options.themeTokens,
    }),
    cache: "no-store",
    headers: getJsonHeaders(options.cookieHeader),
    method: "POST",
  });
  const responseData = await response.json().catch(() => undefined);

  if (!response.ok) {
    return getPlatformError(response, responseData, "Storefront draft update failed");
  }

  const parsed = storefrontDraftSchema.safeParse(responseData);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_storefront_draft_response",
    };
  }

  return {
    ok: true,
    draft: parsed.data.draft,
  };
}

export async function publishStorefrontDraft(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
}): Promise<StorefrontPublishResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    getStorefrontPublishUrl(options.platformApiBaseUrl, options.tenantId),
    {
      cache: "no-store",
      headers: getJsonHeaders(options.cookieHeader),
      method: "POST",
    },
  );
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return getPlatformError(response, data, "Storefront publish failed");
  }

  const parsed = storefrontPublishSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_storefront_publish_response",
    };
  }

  return {
    ok: true,
    publish: parsed.data.storefront,
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
      headers: getJsonHeaders(options.cookieHeader),
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

function getStorefrontDraftUrl(platformApiBaseUrl: string, tenantId: string) {
  return new URL(
    `/platform/tenants/${encodeURIComponent(tenantId)}/storefront/draft`,
    normalizeBaseUrl(platformApiBaseUrl),
  );
}

function getStorefrontPublishUrl(platformApiBaseUrl: string, tenantId: string) {
  return new URL(
    `/platform/tenants/${encodeURIComponent(tenantId)}/storefront/publish`,
    normalizeBaseUrl(platformApiBaseUrl),
  );
}

function getJsonHeaders(cookieHeader?: string | null | undefined) {
  return createPlatformHeaders({
    contentType: "json",
    cookieHeader,
  });
}

