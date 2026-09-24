import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getOptionalBodyString, getRequiredBodyString } from "../shared.js";
import { getPlatformAccess } from "./operator-access.js";

type OperatorContentOptions = Pick<
  PlatformAppOptions,
  | "authorizePlatformPermission"
  | "completePlatformTemplatePreviewUpload"
  | "createPlatformTemplatePreviewUpload"
  | "getEmailTemplate"
  | "getSession"
  | "listEmailTemplates"
  | "listPlatformStorefrontTemplates"
  | "previewEmailTemplate"
  | "publishEmailTemplate"
  | "restoreEmailTemplateVersion"
  | "saveEmailTemplateDraft"
  | "sendEmailTemplateTest"
  | "updatePlatformStorefrontTemplate"
>;

export function registerPlatformOperatorContentRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: OperatorContentOptions,
) {
  app.get("/platform/operator/email-templates", async (context) => {
    if (!options.listEmailTemplates)
      return context.json({ error: "email_templates_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "email.templates.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.listEmailTemplates());
  });

  app.get("/platform/operator/email-templates/:templateKey", async (context) => {
    if (!options.getEmailTemplate)
      return context.json({ error: "email_templates_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "email.templates.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const template = await options.getEmailTemplate(
      context.req.param("templateKey"),
      context.req.query("locale") ?? "en",
    );
    return template
      ? context.json(template)
      : context.json({ error: "email_template_not_found" }, 404);
  });

  app.put("/platform/operator/email-templates/:templateKey/draft", async (context) => {
    if (!options.saveEmailTemplateDraft)
      return context.json({ error: "email_templates_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "email.templates.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await options.saveEmailTemplateDraft({
      content: record.content,
      locale: typeof record.locale === "string" ? record.locale : "en",
      preheader: typeof record.preheader === "string" ? record.preheader : "",
      principal: {
        principalId: access.authorization.principal.id,
        userId: access.session.user.id,
      },
      replyTo:
        typeof record.replyTo === "string" || record.replyTo === null ? record.replyTo : null,
      senderProfile: typeof record.senderProfile === "string" ? record.senderProfile : "",
      subject: typeof record.subject === "string" ? record.subject : "",
      templateKey: context.req.param("templateKey"),
    });
    return result.ok ? context.json(result) : context.json(result, result.status as 400 | 404);
  });

  app.post("/platform/operator/email-templates/:templateKey/preview", async (context) => {
    if (!options.previewEmailTemplate)
      return context.json({ error: "email_templates_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "email.templates.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const preview = await options.previewEmailTemplate({
      content: record.content,
      locale: record.locale === "am" ? "am" : "en",
      preheader: typeof record.preheader === "string" ? record.preheader : "",
      subject: typeof record.subject === "string" ? record.subject : "",
      templateKey: context.req.param("templateKey"),
      variables:
        record.variables && typeof record.variables === "object"
          ? (record.variables as Record<string, string>)
          : undefined,
    });
    if (!preview) return context.json({ error: "email_template_not_found" }, 404);
    return "ok" in preview && preview.ok === false
      ? context.json(preview, preview.status as 400)
      : context.json(preview);
  });

  app.post("/platform/operator/email-templates/:templateKey/publish", async (context) => {
    if (!options.publishEmailTemplate)
      return context.json({ error: "email_templates_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "email.templates.publish",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const locale = getOptionalBodyString(body, "locale") ?? "en";
    const result = await options.publishEmailTemplate({
      locale,
      principal: { principalId: access.authorization.principal.id, userId: access.session.user.id },
      templateKey: context.req.param("templateKey"),
    });
    return result.ok ? context.json(result) : context.json(result, result.status as 400 | 404);
  });

  app.post("/platform/operator/email-templates/:templateKey/restore", async (context) => {
    if (!options.restoreEmailTemplateVersion)
      return context.json({ error: "email_templates_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "email.templates.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await options.restoreEmailTemplateVersion({
      locale: typeof record.locale === "string" ? record.locale : "en",
      principal: { principalId: access.authorization.principal.id, userId: access.session.user.id },
      templateKey: context.req.param("templateKey"),
      version: typeof record.version === "number" ? record.version : 0,
    });
    return result.ok ? context.json(result) : context.json(result, result.status as 404);
  });

  app.post("/platform/operator/email-templates/:templateKey/test", async (context) => {
    if (!options.sendEmailTemplateTest)
      return context.json({ error: "email_templates_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "email.templates.test",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await options.sendEmailTemplateTest({
      content: record.content,
      locale: typeof record.locale === "string" ? record.locale : "en",
      preheader: typeof record.preheader === "string" ? record.preheader : "",
      principal: { principalId: access.authorization.principal.id, userId: access.session.user.id },
      recipient: typeof record.recipient === "string" ? record.recipient : "",
      replyTo:
        typeof record.replyTo === "string" || record.replyTo === null ? record.replyTo : null,
      senderProfile: typeof record.senderProfile === "string" ? record.senderProfile : "",
      subject: typeof record.subject === "string" ? record.subject : "",
      templateKey: context.req.param("templateKey"),
    });
    return result.ok
      ? context.json(result)
      : context.json(result, result.status as 400 | 404 | 503);
  });

  app.get("/platform/operator/storefront-templates", async (context) => {
    if (!options.listPlatformStorefrontTemplates) {
      return context.json({ error: "storefront_templates_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "storefront.templates.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.listPlatformStorefrontTemplates());
  });

  app.post("/platform/operator/storefront-templates/uploads", async (context) => {
    if (!options.createPlatformTemplatePreviewUpload) {
      return context.json({ error: "storefront_template_uploads_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "storefront.templates.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await options.createPlatformTemplatePreviewUpload({
      byteSize: typeof record.byteSize === "number" ? record.byteSize : 0,
      filename: getRequiredBodyString(body, "filename") ?? "",
      mimeType: getRequiredBodyString(body, "mimeType") ?? "",
      operatorUserId: access.session.user.id,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/operator/storefront-templates/uploads/:assetId/complete", async (context) => {
    if (!options.completePlatformTemplatePreviewUpload) {
      return context.json({ error: "storefront_template_uploads_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "storefront.templates.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await options.completePlatformTemplatePreviewUpload({
      assetId: context.req.param("assetId"),
      ...(typeof record.height === "number" ? { height: record.height } : {}),
      ...(typeof record.width === "number" ? { width: record.width } : {}),
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/operator/storefront-templates/:versionId", async (context) => {
    if (!options.updatePlatformStorefrontTemplate) {
      return context.json({ error: "storefront_templates_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "storefront.templates.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await options.updatePlatformStorefrontTemplate({
      ...(typeof record.demoUrl === "string" || record.demoUrl === null
        ? { demoUrl: record.demoUrl }
        : {}),
      operatorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      ...(typeof record.previewAltText === "string" || record.previewAltText === null
        ? { previewAltText: record.previewAltText }
        : {}),
      ...(typeof record.previewAssetId === "string" || record.previewAssetId === null
        ? { previewAssetId: record.previewAssetId }
        : {}),
      templateVersionId: context.req.param("versionId"),
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });
}
