import type { createPlatformDb } from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";

import { createBillingService } from "../../modules/billing/service.js";
import { createBillingOutbox } from "../../modules/billing/outbox.js";
import type { NotificationEventType } from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

/**
 * Sweep paid subscriptions: apply scheduled free downgrades, issue renewal
 * invoices in the lead window, mark past_due when the prepaid period has ended.
 *
 * Enqueued on an interval by the platform worker (see worker.ts).
 */
export function createBillingLifecycleHandler(options: {
  db: PlatformDb;
  recordNotificationEvent?: (input: {
    eventType: NotificationEventType;
    payload?: unknown;
    tenantId: string;
  }) => Promise<unknown>;
}): JobHandler {
  const billing = createBillingService(options.db);
  const outbox = options.recordNotificationEvent
    ? createBillingOutbox(options.db, options.recordNotificationEvent)
    : null;

  return async () => {
    const result = await billing.runBillingLifecycle();
    const delivery = outbox ? await outbox.processDue() : null;

    return {
      ok: true as const,
      scanned: result.scanned,
      renewed: result.renewed,
      pastDue: result.pastDue,
      reminders: result.reminders,
      outbox: delivery,
    };
  };
}
