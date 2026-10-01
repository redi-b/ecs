import { type JobEnqueuer, type JobHandler, UnrecoverableError } from "@ecs/jobs";

export const DOMAIN_SCAN_PAGE_SIZE = 100;

// Queue and reconciler boundaries are explicit; tenant scope comes from the
// persisted job context, never from a merchant-supplied payload.
export function createDomainReconciliationHandlers(options: {
  enabled: () => boolean;
  publishDesired: () => Promise<{ acquired: boolean }>;
  listPage: (cursor?: string) => Promise<{ id: string; tenantId: string }[]>;
  reconcileOne: (input: { domainId: string; tenantId: string }) => Promise<{
    outcome: string;
    reason?: string;
    retryReason?: string;
    routing: { acquired: boolean };
  }>;
  jobsClient: JobEnqueuer;
}): { scan: JobHandler; reconcile: JobHandler } {
  return {
    scan: async (context) => {
      if (context.signal.aborted) throw new Error("domain_scan_cancelled");
      const routing = await options.publishDesired();
      if (!routing.acquired) throw new Error("domain_routing_busy");
      if (!options.enabled()) return { outcome: "disabled", queued: 0 };
      const payload = context.payload as { cursor?: string; scanId?: string };
      const scanId = payload.scanId ?? context.jobRunId;
      const rows = await options.listPage(payload.cursor);
      if (rows.length > DOMAIN_SCAN_PAGE_SIZE) throw new Error("domain_scan_page_exceeded");
      for (const domain of rows) {
        if (context.signal.aborted) throw new Error("domain_scan_cancelled");
        await options.jobsClient.enqueueJob({
          name: "domains.reconcile",
          tenantId: domain.tenantId,
          payload: { domainId: domain.id },
          idempotencyKey: `domains:${scanId}:${domain.id}`,
        });
      }
      if (rows.length === DOMAIN_SCAN_PAGE_SIZE) {
        const last = rows.at(-1);
        if (!last) throw new Error("domain_scan_cursor_missing");
        const cursor = last.id;
        await options.jobsClient.enqueueJob({
          name: "domains.scan",
          payload: { source: "continuation", scanId, cursor },
          idempotencyKey: `domains:${scanId}:after:${cursor}`,
        });
      }
      return { outcome: "scanned", queued: rows.length };
    },
    reconcile: async (context) => {
      if (!context.tenantId) throw new UnrecoverableError("domain_tenant_required");
      if (context.signal.aborted) throw new Error("domain_reconciliation_cancelled");
      const { domainId } = context.payload as { domainId: string };
      const result = await options.reconcileOne({ domainId, tenantId: context.tenantId });
      if (!result.routing.acquired) throw new Error("domain_routing_busy");
      if (["busy", "domain_changed", "retry"].includes(result.outcome) || result.retryReason)
        throw new Error(result.retryReason ?? result.reason ?? `domain_${result.outcome}`);
      return result;
    },
  };
}
