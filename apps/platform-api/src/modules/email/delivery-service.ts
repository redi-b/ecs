import { createHash } from "node:crypto";
import type { createPlatformDb } from "@ecs/db";
import { emailDeliveries, emailTemplateDrafts } from "@ecs/db";
import { and, eq } from "drizzle-orm";

import { encryptSecret } from "../../lib/secret-box.js";
import { type EmailTemplateLocale, getEmailTemplateDefinition } from "./template-catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type EnqueueJob = (input: {
  idempotencyKey: string;
  name: string;
  payload: unknown;
  tenantId: string | null;
}) => Promise<unknown>;

export function createEmailDeliveryService(options: {
  db: PlatformDb;
  encryptionKey: string;
  enqueueJob: EnqueueJob;
}) {
  if (!options.encryptionKey.trim()) {
    throw new Error("Email delivery requires an encryption key");
  }

  return {
    async enqueue(input: {
      idempotencySource: string;
      locale?: EmailTemplateLocale | undefined;
      recipient: string;
      templateKey: string;
      tenantId?: string | null | undefined;
      variables: Record<string, string>;
    }) {
      const definition = getEmailTemplateDefinition(input.templateKey);
      if (!definition) throw new Error("email_template_not_found");
      if (
        definition.requiredVariables.some(
          (name) => typeof input.variables[name] !== "string" || !input.variables[name]?.trim(),
        )
      ) {
        throw new Error("email_template_variables_invalid");
      }
      const recipient = input.recipient.trim().toLowerCase();
      const idempotencyKey = createEmailDeliveryIdempotencyKey({
        idempotencySource: input.idempotencySource,
        recipient,
        templateKey: input.templateKey,
      });
      const locale = input.locale ?? "en";
      const [templateState] = await options.db
        .select({ publishedVersion: emailTemplateDrafts.publishedVersion })
        .from(emailTemplateDrafts)
        .where(
          and(
            eq(emailTemplateDrafts.templateKey, input.templateKey),
            eq(emailTemplateDrafts.locale, locale),
          ),
        )
        .limit(1);
      const variablesEncrypted = encryptSecret(
        JSON.stringify(input.variables),
        options.encryptionKey,
      );
      const [inserted] = await options.db
        .insert(emailDeliveries)
        .values({
          idempotencyKey,
          locale,
          recipient,
          senderProfile: definition.senderProfile,
          templateKey: input.templateKey,
          templateVersion: templateState?.publishedVersion ?? null,
          tenantId: input.tenantId ?? null,
          variablesEncrypted,
        })
        .onConflictDoNothing({ target: emailDeliveries.idempotencyKey })
        .returning({ id: emailDeliveries.id });
      const delivery =
        inserted ??
        (
          await options.db
            .select({ id: emailDeliveries.id })
            .from(emailDeliveries)
            .where(eq(emailDeliveries.idempotencyKey, idempotencyKey))
            .limit(1)
        )[0];
      if (!delivery) throw new Error("email_delivery_create_failed");
      await options.enqueueJob({
        idempotencyKey: `email.deliver:${delivery.id}`,
        name: "email.deliver",
        payload: { deliveryId: delivery.id },
        tenantId: input.tenantId ?? null,
      });
      return { deliveryId: delivery.id, reused: !inserted };
    },
  };
}

export function createEmailDeliveryIdempotencyKey(input: {
  idempotencySource: string;
  recipient: string;
  templateKey: string;
}) {
  return createHash("sha256")
    .update(
      `${input.templateKey}:${input.recipient.trim().toLowerCase()}:${input.idempotencySource}`,
    )
    .digest("hex");
}
