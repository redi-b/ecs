import { type PlatformRequestContext, platformFetch } from "@/lib/platform-api/client";

export type EmailTemplateDocument = {
  content: Array<Record<string, unknown>>;
  type: "doc";
};

export type EmailTemplateCatalog = {
  deliveryConfigured: boolean;
  templates: Array<{
    description: string;
    key: string;
    label: string;
    locales: Array<{
      locale: "am" | "en";
      publishedVersion: number | null;
      source: "custom" | "default";
      updatedAt: string | null;
    }>;
    senderProfile: string;
  }>;
};

export type EmailTemplateDetail = {
  allowedVariables: string[];
  content: EmailTemplateDocument;
  fixtures: Record<string, string>;
  id: string | null;
  label: string;
  locale: "am" | "en";
  preheader: string;
  publishedVersion: number | null;
  replyTo: string | null;
  senderProfile: string;
  subject: string;
  templateKey: string;
  updatedAt: string | null;
  versions: Array<{ publishedAt: string; publishedByPrincipalId: string | null; version: number }>;
};

export async function getEmailTemplates(options: PlatformRequestContext) {
  const response = await platformFetch("/platform/operator/email-templates", options);
  const data = (await response.json().catch(() => null)) as EmailTemplateCatalog | null;
  return response.ok && data
    ? { data, ok: true as const }
    : { message: "email_templates_unavailable", ok: false as const, status: response.status };
}

export async function getEmailTemplate(
  templateKey: string,
  locale: string,
  options: PlatformRequestContext,
) {
  const response = await platformFetch(
    `/platform/operator/email-templates/${encodeURIComponent(templateKey)}`,
    { ...options, searchParams: { locale } },
  );
  const data = (await response.json().catch(() => null)) as EmailTemplateDetail | null;
  return response.ok && data
    ? { data, ok: true as const }
    : { message: "email_template_unavailable", ok: false as const, status: response.status };
}

export async function forwardEmailTemplateCommand(
  options: PlatformRequestContext & { body: unknown; method?: string; path: string },
) {
  const response = await platformFetch(options.path, {
    body: JSON.stringify(options.body),
    contentType: "json",
    cookieHeader: options.cookieHeader,
    method: options.method ?? "POST",
    platformApiBaseUrl: options.platformApiBaseUrl,
  });
  return { data: await response.json().catch(() => ({})), status: response.status };
}
