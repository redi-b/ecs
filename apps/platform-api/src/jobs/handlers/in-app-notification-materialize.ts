import { type JobHandler, UnrecoverableError } from "@ecs/jobs";

import type { InAppNotificationService } from "../../modules/notifications/inbox.js";

export function createInAppNotificationMaterializeHandler(options: {
  inbox: InAppNotificationService;
}): JobHandler<{ eventId: string }> {
  return async ({ payload }) => {
    const eventId = payload?.eventId?.trim();
    if (!eventId) {
      throw new UnrecoverableError("notifications.in-app.materialize requires eventId");
    }
    try {
      return await options.inbox.materializeEvent(eventId);
    } catch (error) {
      if (error instanceof Error && error.message === "in_app_event_not_found") {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  };
}
