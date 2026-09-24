import { type JobHandler, UnrecoverableError } from "@ecs/jobs";

import type { InAppNotificationService } from "../../modules/notifications/inbox.js";

export function createInAppNotificationMaterializeHandler(options: {
  dispatchCustomerEmail?: ((eventId: string) => Promise<unknown>) | undefined;
  inbox: InAppNotificationService;
}): JobHandler<{ eventId: string }> {
  return async ({ payload }) => {
    const eventId = payload?.eventId?.trim();
    if (!eventId) {
      throw new UnrecoverableError("notifications.in-app.materialize requires eventId");
    }
    try {
      const inbox = await options.inbox.materializeEvent(eventId);
      const customerEmail = options.dispatchCustomerEmail
        ? await options.dispatchCustomerEmail(eventId)
        : { skipped: "email_delivery_unavailable" as const };
      return { customerEmail, inbox };
    } catch (error) {
      if (error instanceof Error && error.message === "in_app_event_not_found") {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  };
}
