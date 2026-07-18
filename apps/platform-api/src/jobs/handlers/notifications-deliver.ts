import type { createPlatformDb } from "@ecs/db";
import { UnrecoverableError, type JobHandler } from "@ecs/jobs";

import { deliverNotificationLog } from "../../modules/notifications/delivery.js";
import type { NotificationProviderRegistry } from "../../modules/notifications/providers/registry.js";
import type { NotificationRenderer } from "../../modules/notifications/renderer.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type NotificationsDeliverPayload = {
  notificationLogId: string;
};

export type CreateNotificationsDeliverHandlerOptions = {
  db: PlatformDb;
  renderer: NotificationRenderer;
  providers: NotificationProviderRegistry;
  telegramOrderActions?: {
    secret: string;
    isOperatorChat: (input: {
      tenantId: string;
      chatId: string;
    }) => Promise<{ allowed: boolean }>;
  };
};

function readNotificationLogId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const id = (payload as NotificationsDeliverPayload).notificationLogId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function createNotificationsDeliverHandler(
  options: CreateNotificationsDeliverHandlerOptions,
): JobHandler<NotificationsDeliverPayload> {
  return async (ctx) => {
    const notificationLogId = readNotificationLogId(ctx.payload);
    if (!notificationLogId) {
      throw new UnrecoverableError("notifications.deliver requires notificationLogId");
    }

    const result = await deliverNotificationLog({
      db: options.db,
      notificationLogId,
      renderer: options.renderer,
      providers: options.providers,
      ...(options.telegramOrderActions
        ? { telegramOrderActions: options.telegramOrderActions }
        : {}),
    });

    if (result.ok) {
      return {
        status: result.status,
        providerReference: result.providerReference ?? null,
      };
    }

    if (!result.retryable) {
      throw new UnrecoverableError(result.error);
    }

    throw new Error(result.error);
  };
}
