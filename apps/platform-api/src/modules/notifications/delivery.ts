import type { createPlatformDb } from "@ecs/db";
import { notificationLogs } from "@ecs/db";
import { eq } from "drizzle-orm";

import type { NotificationProviderRegistry } from "./providers/registry.js";
import type { NotificationRenderer } from "./renderer.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type DeliverNotificationLogInput = {
  db: PlatformDb;
  notificationLogId: string;
  renderer: NotificationRenderer;
  providers: NotificationProviderRegistry;
};

export type DeliverNotificationLogResult =
  | { ok: true; status: "sent" | "already_sent"; providerReference?: string }
  | { ok: false; status: "failed"; error: string; retryable: boolean };

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Domain delivery: load log → render → provider.send → update status.
 * Idempotent when the log is already sent.
 */
export async function deliverNotificationLog(
  input: DeliverNotificationLogInput,
): Promise<DeliverNotificationLogResult> {
  const [log] = await input.db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.id, input.notificationLogId))
    .limit(1);

  if (!log) {
    return {
      ok: false,
      status: "failed",
      error: `notification_log_not_found:${input.notificationLogId}`,
      retryable: false,
    };
  }

  if (log.status === "sent") {
    const result: DeliverNotificationLogResult = {
      ok: true,
      status: "already_sent",
    };
    if (log.providerReference) {
      result.providerReference = log.providerReference;
    }
    return result;
  }

  const provider = input.providers.get(log.channel);
  if (!provider) {
    const error = `notification_provider_missing:${log.channel}`;
    await input.db
      .update(notificationLogs)
      .set({
        status: "failed",
        error,
      })
      .where(eq(notificationLogs.id, log.id));
    return { ok: false, status: "failed", error, retryable: false };
  }

  try {
    const rendered = await input.renderer.render({
      channel: log.channel,
      eventType: log.eventType,
      tenantId: log.tenantId,
      payload: log.payload ?? {},
      recipient: log.recipient,
    });

    const sendInput: Parameters<typeof provider.send>[0] = {
      channel: log.channel,
      tenantId: log.tenantId,
      recipient: log.recipient,
      eventType: log.eventType,
      body: rendered.body,
    };
    if (rendered.subject !== undefined) {
      sendInput.subject = rendered.subject;
    }
    if (rendered.metadata !== undefined) {
      sendInput.metadata = rendered.metadata;
    }

    const sendResult = await provider.send(sendInput);
    const sentAt = new Date();

    await input.db
      .update(notificationLogs)
      .set({
        status: "sent",
        error: null,
        providerReference: sendResult.providerReference ?? null,
        sentAt,
      })
      .where(eq(notificationLogs.id, log.id));

    const result: DeliverNotificationLogResult = {
      ok: true,
      status: "sent",
    };
    if (sendResult.providerReference !== undefined) {
      result.providerReference = sendResult.providerReference;
    }
    return result;
  } catch (error) {
    const message = errorMessage(error);
    await input.db
      .update(notificationLogs)
      .set({
        status: "failed",
        error: message,
      })
      .where(eq(notificationLogs.id, log.id));

    return {
      ok: false,
      status: "failed",
      error: message,
      retryable: true,
    };
  }
}
