import type { createPlatformDb } from "@ecs/db";
import { emailDeliveries, emailTemplateVersions } from "@ecs/db";
import { type JobHandler, UnrecoverableError } from "@ecs/jobs";
import { and, eq } from "drizzle-orm";

import { decryptSecret } from "../../lib/secret-box.js";
import { getEmailTemplateDefinition } from "../../modules/email/template-catalog.js";
import { renderEmailTemplate } from "../../modules/email/template-renderer.js";
import type { NotificationProvider } from "../../modules/notifications/providers/types.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createEmailDeliverHandler(options: {
  db: PlatformDb;
  encryptionKey: string;
  provider: NotificationProvider;
}): JobHandler<{ deliveryId: string }> {
  return async ({ attempt, payload }) => {
    const deliveryId = payload?.deliveryId?.trim();
    if (!deliveryId) throw new UnrecoverableError("email.deliver requires deliveryId");
    const [delivery] = await options.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.id, deliveryId))
      .limit(1);
    if (!delivery) throw new UnrecoverableError("email_delivery_not_found");
    if (delivery.status === "sent")
      return { status: "sent", providerReference: delivery.providerReference };
    const definition = getEmailTemplateDefinition(delivery.templateKey);
    if (!definition || (delivery.locale !== "en" && delivery.locale !== "am")) {
      await fail("email_template_not_found");
      throw new UnrecoverableError("email_template_not_found");
    }
    let variables: Record<string, string>;
    try {
      variables = JSON.parse(
        decryptSecret(delivery.variablesEncrypted, options.encryptionKey),
      ) as Record<string, string>;
    } catch {
      await fail("email_variables_unreadable");
      throw new UnrecoverableError("email_variables_unreadable");
    }
    const [published] = delivery.templateVersion
      ? await options.db
          .select()
          .from(emailTemplateVersions)
          .where(
            and(
              eq(emailTemplateVersions.templateKey, delivery.templateKey),
              eq(emailTemplateVersions.locale, delivery.locale),
              eq(emailTemplateVersions.version, delivery.templateVersion),
            ),
          )
          .limit(1)
      : [];
    if (delivery.templateVersion && !published) {
      await fail("email_template_version_not_found");
      throw new UnrecoverableError("email_template_version_not_found");
    }
    const source = published ?? definition.locales[delivery.locale];
    const rendered = renderEmailTemplate({
      content: source.content,
      locale: delivery.locale,
      preheader: source.preheader,
      subject: source.subject,
      variables,
    });
    try {
      const result = await options.provider.send({
        body: rendered.text,
        channel: "email",
        eventType: delivery.templateKey,
        html: rendered.html,
        idempotencyKey: delivery.idempotencyKey,
        recipient: delivery.recipient,
        ...("replyTo" in source && source.replyTo ? { replyTo: source.replyTo } : {}),
        senderProfile: definition.senderProfile,
        subject: rendered.subject,
        tags: { template: delivery.templateKey },
        tenantId: delivery.tenantId ?? "platform",
      });
      await options.db
        .update(emailDeliveries)
        .set({
          error: null,
          providerReference: result.providerReference ?? null,
          sentAt: new Date(),
          status: "sent",
        })
        .where(eq(emailDeliveries.id, delivery.id));
      return { providerReference: result.providerReference ?? null, status: "sent" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "email_delivery_failed";
      await options.db
        .update(emailDeliveries)
        .set({ error: message.slice(0, 1_000), status: attempt >= 5 ? "failed" : "retrying" })
        .where(eq(emailDeliveries.id, delivery.id));
      throw error;
    }

    async function fail(error: string) {
      await options.db
        .update(emailDeliveries)
        .set({ error, status: "failed" })
        .where(eq(emailDeliveries.id, deliveryId));
    }
  };
}
