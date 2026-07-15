import type { createPlatformDb } from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";

import { createBillingService } from "../../modules/billing/service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

/**
 * Sweep paid subscriptions: apply scheduled free downgrades, issue renewal
 * invoices in the lead window, mark past_due when the prepaid period has ended.
 *
 * Enqueued on an interval by the platform worker (see worker.ts).
 */
export function createBillingLifecycleHandler(options: {
  db: PlatformDb;
}): JobHandler {
  const billing = createBillingService(options.db);

  return async () => {
    const result = await billing.runBillingLifecycle();
    return {
      ok: true as const,
      ...result,
    };
  };
}
