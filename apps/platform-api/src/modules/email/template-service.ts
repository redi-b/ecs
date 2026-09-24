import type { createPlatformDb } from "@ecs/db";
import { auditLogs, emailTemplateDrafts, emailTemplateVersions } from "@ecs/db";
import { and, desc, eq, sql } from "drizzle-orm";

import type { NotificationProvider } from "../notifications/providers/types.js";
import {
  EMAIL_TEMPLATE_CATALOG,
  type EmailTemplateLocale,
  emailTemplateDocumentSchema,
  getEmailTemplateDefinition,
} from "./template-catalog.js";
import { renderEmailTemplate, validateTemplateVariables } from "./template-renderer.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type Principal = { principalId: string; userId: string };

export function createEmailTemplateService(options: {
  db: PlatformDb;
  emailProvider?: NotificationProvider | null | undefined;
}) {
  const { db } = options;

  async function resolveDraft(templateKey: string, locale: string) {
    const definition = getEmailTemplateDefinition(templateKey);
    if (!definition || !isLocale(locale)) return null;
    const [stored] = await db
      .select()
      .from(emailTemplateDrafts)
      .where(
        and(
          eq(emailTemplateDrafts.templateKey, templateKey),
          eq(emailTemplateDrafts.locale, locale),
        ),
      )
      .limit(1);
    const fallback = definition.locales[locale];
    return {
      content: stored?.content ?? fallback.content,
      id: stored?.id ?? null,
      locale,
      preheader: stored?.preheader ?? fallback.preheader,
      publishedVersion: stored?.publishedVersion ?? null,
      replyTo: stored?.replyTo ?? null,
      senderProfile: stored?.senderProfile ?? definition.senderProfile,
      subject: stored?.subject ?? fallback.subject,
      templateKey,
      updatedAt: stored?.updatedAt?.toISOString() ?? null,
    };
  }

  return {
    async list() {
      const drafts = await db.select().from(emailTemplateDrafts);
      const byKey = new Map(drafts.map((row) => [`${row.templateKey}:${row.locale}`, row]));
      return {
        deliveryConfigured: Boolean(options.emailProvider),
        templates: EMAIL_TEMPLATE_CATALOG.map((definition) => ({
          description: definition.description,
          key: definition.key,
          label: definition.label,
          locales: (["en", "am"] as const).map((locale) => {
            const row = byKey.get(`${definition.key}:${locale}`);
            return {
              locale,
              publishedVersion: row?.publishedVersion ?? null,
              source: row ? "custom" : "default",
              updatedAt: row?.updatedAt?.toISOString() ?? null,
            };
          }),
          senderProfile: definition.senderProfile,
        })),
      };
    },

    async get(templateKey: string, locale: string) {
      const definition = getEmailTemplateDefinition(templateKey);
      const draft = await resolveDraft(templateKey, locale);
      if (!definition || !draft || !isLocale(locale)) return null;
      const versions = await db
        .select({
          publishedAt: emailTemplateVersions.publishedAt,
          publishedByPrincipalId: emailTemplateVersions.publishedByPrincipalId,
          version: emailTemplateVersions.version,
        })
        .from(emailTemplateVersions)
        .where(
          and(
            eq(emailTemplateVersions.templateKey, templateKey),
            eq(emailTemplateVersions.locale, locale),
          ),
        )
        .orderBy(desc(emailTemplateVersions.version))
        .limit(20);
      return {
        ...draft,
        allowedVariables: Object.keys(definition.fixtures),
        fixtures: definition.fixtures,
        label: definition.label,
        versions: versions.map((version) => ({
          ...version,
          publishedAt: version.publishedAt.toISOString(),
        })),
      };
    },

    async saveDraft(input: {
      content: unknown;
      locale: string;
      preheader: string;
      principal: Principal;
      replyTo?: string | null | undefined;
      senderProfile: string;
      subject: string;
      templateKey: string;
    }) {
      const normalized = validateInput(input);
      if (!normalized.ok) return normalized;
      const [saved] = await db
        .insert(emailTemplateDrafts)
        .values({
          ...normalized.value,
          createdByPrincipalId: input.principal.principalId,
          updatedByPrincipalId: input.principal.principalId,
        })
        .onConflictDoUpdate({
          set: {
            ...normalized.value,
            updatedAt: new Date(),
            updatedByPrincipalId: input.principal.principalId,
          },
          target: [emailTemplateDrafts.templateKey, emailTemplateDrafts.locale],
        })
        .returning();
      await audit(input.principal, "email_template.draft_saved", input.templateKey, {
        locale: input.locale,
      });
      return { ok: true as const, draft: saved };
    },

    async publish(input: { locale: string; principal: Principal; templateKey: string }) {
      const draft = await resolveDraft(input.templateKey, input.locale);
      const definition = getEmailTemplateDefinition(input.templateKey);
      if (!draft || !definition || !isLocale(input.locale)) {
        return { error: "email_template_not_found" as const, ok: false as const, status: 404 };
      }
      const normalized = validateInput(draft);
      if (!normalized.ok) return normalized;
      let version = 0;
      await db.transaction(async (tx) => {
        // Serialize publication per template and locale. Without this lock two
        // operators could both calculate the same next immutable version.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`${input.templateKey}:${input.locale}`}))`,
        );
        const [latest] = await tx
          .select({ version: emailTemplateVersions.version })
          .from(emailTemplateVersions)
          .where(
            and(
              eq(emailTemplateVersions.templateKey, input.templateKey),
              eq(emailTemplateVersions.locale, input.locale),
            ),
          )
          .orderBy(desc(emailTemplateVersions.version))
          .limit(1);
        version = (latest?.version ?? 0) + 1;
        await tx.insert(emailTemplateVersions).values({
          ...normalized.value,
          publishedByPrincipalId: input.principal.principalId,
          version,
        });
        await tx
          .insert(emailTemplateDrafts)
          .values({
            ...normalized.value,
            createdByPrincipalId: input.principal.principalId,
            publishedVersion: version,
            updatedByPrincipalId: input.principal.principalId,
          })
          .onConflictDoUpdate({
            set: {
              publishedVersion: version,
              updatedAt: new Date(),
              updatedByPrincipalId: input.principal.principalId,
            },
            target: [emailTemplateDrafts.templateKey, emailTemplateDrafts.locale],
          });
      });
      await audit(input.principal, "email_template.published", input.templateKey, {
        locale: input.locale,
        version,
      });
      return { ok: true as const, version };
    },

    async restore(input: {
      locale: string;
      principal: Principal;
      templateKey: string;
      version: number;
    }) {
      const [version] = await db
        .select()
        .from(emailTemplateVersions)
        .where(
          and(
            eq(emailTemplateVersions.templateKey, input.templateKey),
            eq(emailTemplateVersions.locale, input.locale),
            eq(emailTemplateVersions.version, input.version),
          ),
        )
        .limit(1);
      if (!version) {
        return {
          error: "email_template_version_not_found" as const,
          ok: false as const,
          status: 404,
        };
      }
      await db
        .insert(emailTemplateDrafts)
        .values({
          content: version.content,
          createdByPrincipalId: input.principal.principalId,
          locale: version.locale,
          preheader: version.preheader,
          replyTo: version.replyTo,
          senderProfile: version.senderProfile,
          subject: version.subject,
          templateKey: version.templateKey,
          updatedByPrincipalId: input.principal.principalId,
        })
        .onConflictDoUpdate({
          set: {
            content: version.content,
            preheader: version.preheader,
            replyTo: version.replyTo,
            senderProfile: version.senderProfile,
            subject: version.subject,
            updatedAt: new Date(),
            updatedByPrincipalId: input.principal.principalId,
          },
          target: [emailTemplateDrafts.templateKey, emailTemplateDrafts.locale],
        });
      await audit(input.principal, "email_template.version_restored", input.templateKey, {
        locale: input.locale,
        version: input.version,
      });
      return { ok: true as const };
    },

    async preview(input: {
      content: unknown;
      locale?: EmailTemplateLocale | undefined;
      preheader: string;
      subject: string;
      templateKey: string;
      variables?: Record<string, string> | undefined;
    }) {
      const definition = getEmailTemplateDefinition(input.templateKey);
      if (!definition) return null;
      const content = emailTemplateDocumentSchema.safeParse(input.content);
      if (!content.success || !input.subject.trim() || input.subject.length > 200) {
        return { error: "email_template_invalid" as const, ok: false as const, status: 400 };
      }
      const variables = { ...definition.fixtures, ...input.variables };
      const validation = validateTemplateVariables({
        allowed: Object.keys(definition.fixtures),
        content: content.data,
        preheader: input.preheader,
        required: definition.requiredVariables,
        subject: input.subject,
      });
      if (validation.missing.length || validation.unknown.length) {
        return {
          details: validation,
          error: "email_template_variables_invalid" as const,
          ok: false as const,
          status: 400,
        };
      }
      return renderEmailTemplate({
        content: content.data,
        locale: input.locale,
        preheader: input.preheader,
        subject: input.subject,
        variables,
      });
    },

    async sendTest(input: {
      content: unknown;
      locale: string;
      preheader: string;
      principal: Principal;
      recipient: string;
      replyTo?: string | null | undefined;
      senderProfile: string;
      subject: string;
      templateKey: string;
    }) {
      if (!options.emailProvider) {
        return { error: "email_delivery_unavailable" as const, ok: false as const, status: 503 };
      }
      if (!isMailbox(input.recipient)) {
        return { error: "email_recipient_invalid" as const, ok: false as const, status: 400 };
      }
      const normalized = validateInput(input);
      if (!normalized.ok) return normalized;
      const definition = getEmailTemplateDefinition(input.templateKey);
      if (!definition) {
        return { error: "email_template_not_found" as const, ok: false as const, status: 404 };
      }
      const rendered = renderEmailTemplate({
        content: normalized.value.content,
        locale: input.locale as EmailTemplateLocale,
        preheader: normalized.value.preheader,
        subject: `[Test] ${normalized.value.subject}`,
        variables: definition.fixtures,
      });
      await options.emailProvider.send({
        body: rendered.text,
        channel: "email",
        eventType: "platform.email_template_test",
        html: rendered.html,
        recipient: input.recipient,
        ...(normalized.value.replyTo ? { replyTo: normalized.value.replyTo } : {}),
        senderProfile: normalized.value.senderProfile,
        subject: rendered.subject,
        tags: { template: input.templateKey, type: "test" },
        tenantId: "platform",
      });
      await audit(input.principal, "email_template.test_sent", input.templateKey, {
        locale: input.locale,
      });
      return { ok: true as const };
    },
  };

  function validateInput(input: {
    content: unknown;
    locale: string;
    preheader: string;
    replyTo?: string | null | undefined;
    senderProfile: string;
    subject: string;
    templateKey: string;
  }) {
    const definition = getEmailTemplateDefinition(input.templateKey);
    if (!definition || !isLocale(input.locale)) {
      return { error: "email_template_not_found" as const, ok: false as const, status: 404 };
    }
    const content = emailTemplateDocumentSchema.safeParse(input.content);
    if (
      !content.success ||
      !input.subject.trim() ||
      input.subject.length > 200 ||
      input.preheader.length > 300 ||
      (input.replyTo != null && input.replyTo.trim() !== "" && !isMailbox(input.replyTo))
    ) {
      return { error: "email_template_invalid" as const, ok: false as const, status: 400 };
    }
    if (input.senderProfile !== definition.senderProfile) {
      return { error: "email_sender_profile_invalid" as const, ok: false as const, status: 400 };
    }
    const variables = validateTemplateVariables({
      allowed: Object.keys(definition.fixtures),
      content: content.data,
      preheader: input.preheader,
      required: definition.requiredVariables,
      subject: input.subject,
    });
    if (variables.missing.length || variables.unknown.length) {
      return {
        details: variables,
        error: "email_template_variables_invalid" as const,
        ok: false as const,
        status: 400,
      };
    }
    return {
      ok: true as const,
      value: {
        content: content.data,
        locale: input.locale,
        preheader: input.preheader.trim(),
        replyTo: input.replyTo?.trim() || null,
        senderProfile: input.senderProfile,
        subject: input.subject.trim(),
        templateKey: input.templateKey,
      },
    };
  }

  async function audit(principal: Principal, action: string, targetId: string, metadata: object) {
    await db.insert(auditLogs).values({
      action,
      actorUserId: principal.userId,
      metadata,
      platformPrincipalId: principal.principalId,
      targetId,
      targetType: "email_template",
    });
  }
}

function isLocale(value: string): value is EmailTemplateLocale {
  return value === "en" || value === "am";
}

function isMailbox(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
